// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program).
//
// Same answers as csv-reader 1.0.0 for every input {text, header}:
// {columns, rows, errors}. Pure: no clock, no randomness, nothing kept
// from one call to the next.
//
// Strategy (all in one pass, left to right):
// - Quote-free records (about a third of them): one slice + split(',').
//   A record qualifies only when no '"' sits before its line break and
//   no CR sits inside it except a trailing CRLF's.
// - Unquoted fields: one native regex scan for the next of , " \n \r,
//   then a single slice for the field. A '"' inside an unquoted field is
//   a literal (scan just continues past it); a stray CR is dropped and
//   only then does the field need segment joins (rare).
// - Quoted fields: indexOf('"') jumps straight to the next quote, so
//   "" collapses and \r -> \n conversion only touch fields that have
//   them. Line counting inside quotes runs only when the quoted span
//   holds a line break at all.
// - No per-character string building and no per-field object on the
//   common path: the field scanners return the value and report how the
//   field ended through one shared variable.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

// Next delimiter of an unquoted field: comma, quote, LF or CR.
const DELIM = /[",\n\r]/g;
// CRLF or a lone CR inside quotes both become one LF.
const CR_RE = /\r\n?/g;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const s = String(input.text);
  const header = input.header === true;
  const n = s.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (s.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows
  // (null while it is the header). The field scanners read these.
  let recordLine = 1;
  let recordRow = null;
  // How the last field read ended (COMMA, LINE_BREAK or END).
  let ended = END;

  // Reads an unquoted field starting at pos, onto `init` ('' normally,
  // '"' when a quote never closed, the quoted value for quote junk).
  // Returns the value; sets `ended`. `added` counts the characters kept
  // beyond `init` (only the quote-junk check needs it).
  let added = 0;
  function scanUnquoted(init) {
    let acc = init;
    let head = pos;
    let cur = pos;
    added = 0;
    for (;;) {
      DELIM.lastIndex = cur;
      const m = DELIM.exec(s);
      if (m === null) {
        const seg = s.slice(head, n);
        added += seg.length;
        pos = n;
        ended = END;
        return acc === '' ? seg : acc + seg;
      }
      const di = m.index;
      const dc = m[0].charCodeAt(0);
      if (dc === 44) {
        // Comma: the field ends, the record goes on.
        const seg = s.slice(head, di);
        added += seg.length;
        pos = di + 1;
        ended = COMMA;
        return acc === '' ? seg : acc + seg;
      }
      if (dc === 10) {
        const seg = s.slice(head, di);
        added += seg.length;
        pos = di + 1;
        line += 1;
        ended = LINE_BREAK;
        return acc === '' ? seg : acc + seg;
      }
      if (dc === 13) {
        if (s.charCodeAt(di + 1) === 10) {
          const seg = s.slice(head, di);
          added += seg.length;
          pos = di + 2;
          line += 1;
          ended = LINE_BREAK;
          return acc === '' ? seg : acc + seg;
        }
        // Stray CR outside quotes: dropped, error kept, field goes on.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        const seg = s.slice(head, di);
        added += seg.length;
        acc = acc === '' ? seg : acc + seg;
        head = di + 1;
        cur = di + 1;
        continue;
      }
      // A quote inside an unquoted field is a literal character.
      cur = di + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Returns the
  // value; sets `ended` (through scanUnquoted for junk / unterminated).
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let acc = null;
    let seg = p;
    for (;;) {
      const q = s.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the
        // text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return scanUnquoted('"');
      }
      if (s.charCodeAt(q + 1) === 34) {
        // Doubled quote: one quote in the value.
        let part = s.slice(seg, q);
        if (part.indexOf('\r') !== -1) part = part.replace(CR_RE, '\n');
        acc = acc === null ? part + '"' : acc + part + '"';
        seg = q + 2;
        p = q + 2;
        continue;
      }
      // Closing quote at q.
      let part = s.slice(seg, q);
      if (part.indexOf('\r') !== -1) part = part.replace(CR_RE, '\n');
      const value = acc === null ? part : acc + part;
      // Count the line breaks inside the quotes: every LF, and every
      // CR (a CRLF counts once). Only when the span holds one at all.
      const ni = s.indexOf('\n', open + 1);
      const ri = s.indexOf('\r', open + 1);
      if ((ni !== -1 && ni < q) || (ri !== -1 && ri < q)) {
        for (let i = open + 1; i < q; i++) {
          const c = s.charCodeAt(i);
          if (c === 13) {
            line += 1;
            if (s.charCodeAt(i + 1) === 10) i += 1;
          } else if (c === 10) {
            line += 1;
          }
        }
      }
      pos = q + 1;
      if (pos >= n) {
        ended = END;
        return value;
      }
      const c = s.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        ended = COMMA;
        return value;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        ended = LINE_BREAK;
        return value;
      }
      if (c === 13 && s.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        ended = LINE_BREAK;
        return value;
      }
      // What follows the closing quote is appended as it stands.
      const junk = scanUnquoted(value);
      if (added > 0) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      return junk;
    }
  }

  // Files one record's fields away (header, short/long row, padding and
  // cutting included). A line that held only stray CRs is no record.
  function commit(fields, lastQuoted) {
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = s.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && s.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: a record with no quote before its line break and no CR
    // inside it except a trailing CRLF's is one slice + split(',').
    const nl = s.indexOf('\n', pos);
    const spanEnd = nl === -1 ? n : nl;
    const qi = s.indexOf('"', pos);
    if (qi === -1 || qi >= spanEnd) {
      const ri = s.indexOf('\r', pos);
      if (ri === -1 || ri >= spanEnd || (nl !== -1 && ri === nl - 1)) {
        const end = nl !== -1 && ri === nl - 1 ? nl - 1 : spanEnd;
        commit(s.slice(pos, end).split(','), false);
        pos = nl === -1 ? n : nl + 1;
        if (nl !== -1) line += 1;
        continue;
      }
    }

    const fields = [];
    let lastQuoted = false;
    do {
      if (s.charCodeAt(pos) === 34) {
        lastQuoted = true;
        fields.push(scanQuoted());
      } else {
        lastQuoted = false;
        fields.push(scanUnquoted(''));
      }
    } while (ended === COMMA);
    commit(fields, lastQuoted);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
