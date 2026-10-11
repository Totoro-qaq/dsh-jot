import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 压缩后的 lib/client.js 会去掉依赖源码里的许可证注释。
// esbuild 的 legalComments 只保留 /*! 注释，盖不住单独存放 LICENSE 的 MIT 包。
// 因此从 metafile 里真正被打进产物的文件反查包，并把版权与许可证原文写进发布包。

const LICENSE_NAME = /^(?:licen[cs]e|copying|notice|unlicense)(?:[._-].*)?$/i;
const LICENSE_DIR = /^(?:licen[cs]es?|notices)$/i;
const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.md', '.markdown', '.txt']);
const ALIASES = new Map([
  ['mit', 'MIT'],
  ['isc', 'ISC'],
  ['bsd-2-clause', 'BSD-2-Clause'],
  ['bsd-3-clause', 'BSD-3-Clause'],
  ['0bsd', '0BSD'],
  ['bsd-zero-clause', '0BSD'],
  ['apache-2.0', 'Apache-2.0'],
  ['apache-2', 'Apache-2.0'],
  ['unlicense', 'Unlicense'],
  ['mit-0', 'MIT-0'],
]);

const MIT = `MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

// SPDX 清单里的 ISC 文本把版权写成了 Internet Systems Consortium，那是 ISC 自己软件的声明，不能套到别的包上。
const ISC = `ISC License

Copyright (c) <year> <copyright holders>

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`;

const BSD_2 = `Copyright (c) <year> <owner>

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;

const BSD_3 = `Copyright (c) <year> <owner>

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;

const BSD_0 = `Copyright (C) YEAR by AUTHOR EMAIL

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
`;

const MIT_0 = `MIT No Attribution

Copyright <YEAR> <COPYRIGHT HOLDER>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

const UNLICENSE = `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this software dedicate any and all copyright interest in the software to the public domain. We make this dedication for the benefit of the public at large and to the detriment of our heirs and successors. We intend this dedication to be an overt act of relinquishment in perpetuity of all present and future rights to this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
`;

const TEMPLATES = new Map([
  ['MIT', MIT],
  ['ISC', ISC],
  ['BSD-2-Clause', BSD_2],
  ['BSD-3-Clause', BSD_3],
  ['0BSD', BSD_0],
  ['MIT-0', MIT_0],
  ['Unlicense', UNLICENSE],
]);

const COPYRIGHT_PLACEHOLDER = /<(?:year|copyright holders|owner|YEAR|COPYRIGHT HOLDER)>|\[yyyy\]|AUTHOR EMAIL/;

let apacheText;

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function packageLocation(input) {
  const parts = input.split(/[\\/]/);
  const index = parts.lastIndexOf('node_modules');
  if (index < 0) return null;
  const scoped = parts[index + 1]?.startsWith('@');
  const count = scoped ? 3 : 2;
  if (index + count > parts.length) return null;
  const separator = input.includes('\\') ? '\\' : '/';
  return parts.slice(0, index + count).join(separator);
}

export function bundledPackageLocations(inputs) {
  const locations = new Set();
  for (const input of inputs) {
    const location = packageLocation(input);
    if (location) locations.add(location);
  }
  return [...locations];
}

function tokens(expression) {
  return expression.match(/[A-Za-z0-9.+-]+|[()]/g) ?? [];
}

function isOperator(token) {
  return /^(?:OR|AND|WITH)$/i.test(token);
}

export function licenseIds(expression) {
  return tokens(expression).filter(token => token !== '(' && token !== ')' && !isOperator(token));
}

export function licenseExpression(pkg) {
  const value = pkg.license ?? pkg.licenses;
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.type === 'string') return value.type.trim();
  if (Array.isArray(value)) {
    const types = value.map(item => typeof item === 'string' ? item : item?.type).filter(item => typeof item === 'string' && item.trim());
    if (types.length === 1) return types[0].trim();
    if (types.length > 1) return types.map(item => item.trim()).join(' OR ');
  }
  return '';
}

/** 仅在纯 OR 且其中一个选项是 MIT 时选用 MIT。含 AND 时两份许可证都要保留，不能单方面改选。 */
export function electsMit(expression) {
  const operators = tokens(expression).filter(isOperator).map(token => token.toUpperCase());
  if (!operators.includes('OR') || operators.some(operator => operator !== 'OR')) return false;
  return licenseIds(expression).some(id => id.toUpperCase() === 'MIT');
}

function canonicalLicense(id) {
  return ALIASES.get(id.toLowerCase()) ?? null;
}

function stripCommentMarker(line) {
  return line.trim()
    .replace(/^(?:\/\*+!?|\*+\/?|\/\/+|#+)+\s?/, '')
    .replace(/\*\/\s*$/, '')
    .trim();
}

function isCopyrightNotice(line) {
  // 免责声明里的 “COPYRIGHT HOLDERS” 不是版权声明。版权行以 Copyright、(c) 或 © 开头，并带年份或 (c)。
  if (/^copyright\b/i.test(line)) return /\(c\)/i.test(line) || line.includes('©') || /\b\d{4}\b/.test(line);
  if (/^\(c\)\b/i.test(line) || /^©/.test(line)) return true;
  return false;
}

export function copyrightNotices(text, lineLimit = 80) {
  const notices = [];
  const lines = normalizeNewlines(text).split('\n').slice(0, lineLimit);
  for (const raw of lines) {
    const line = stripCommentMarker(raw).replace(/\s+/g, ' ');
    if (!line || line.length > 300 || !isCopyrightNotice(line) || notices.includes(line)) continue;
    notices.push(line);
  }
  return notices;
}

function textHasGrant(text) {
  return /permission is hereby granted/i.test(text)
    || /permission to use, copy, modify/i.test(text)
    || /licensed under the apache license/i.test(text)
    || /grant of copyright license/i.test(text)
    || /gnu general public license/i.test(text)
    || /redistribution and use in source and binary forms/i.test(text)
    || /this is free and unencumbered software/i.test(text)
    || /mozilla public license/i.test(text);
}

export function noticeCoversPackage(text) {
  const first = text.split('\n', 1)[0] ?? '';
  if (!/^(?:@[^/\s]+\/)?[^@\s]+@\S+$/.test(first)) return false;
  if (/see the package source for license details/i.test(text)) return false;
  if (!copyrightNotices(text, Number.POSITIVE_INFINITY).length) return false;
  if (!textHasGrant(text)) return false;
  return true;
}

function authorNotice(pkg) {
  const people = pkg.author ? [pkg.author] : Array.isArray(pkg.contributors) ? pkg.contributors : [];
  const rendered = [];
  for (const person of people) {
    if (typeof person === 'string' && person.trim()) rendered.push(person.trim());
    else if (person && typeof person === 'object' && typeof person.name === 'string' && person.name.trim()) {
      const email = typeof person.email === 'string' && person.email.trim() ? ` <${person.email.trim()}>` : '';
      rendered.push(`${person.name.trim()}${email}`);
    }
  }
  return rendered.length ? `Copyright (c) ${rendered.join(', ')}` : '';
}

function repositoryUrl(pkg) {
  const value = pkg.repository;
  const raw = typeof value === 'string' ? value : value?.url;
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^git\+/, '').replace(/\.git$/, '');
}

async function listLicenseFiles(location) {
  const names = [];
  let entries;
  try {
    entries = await readdir(location, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read package directory ${location}: ${error.message}`);
  }
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    if (entry.isFile() && LICENSE_NAME.test(entry.name)) names.push(entry.name);
    if (!entry.isDirectory() || !LICENSE_DIR.test(entry.name)) continue;
    const children = await readdir(join(location, entry.name), { withFileTypes: true });
    children.sort((left, right) => compareText(left.name, right.name));
    for (const child of children) {
      if (child.isFile()) names.push(`${entry.name}/${child.name}`);
    }
  }
  return names;
}

async function findCopyright(location) {
  const files = [];
  async function walk(directory, depth) {
    if (files.length >= 40 || depth > 2) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!LICENSE_DIR.test(entry.name)) await walk(full, depth + 1);
        continue;
      }
      if (LICENSE_NAME.test(entry.name)) continue;
      const extension = extname(entry.name).toLowerCase();
      if (!SOURCE_EXT.has(extension) && !/^readme/i.test(entry.name)) continue;
      files.push(full);
    }
  }
  await walk(location, 0);
  files.sort((left, right) => {
    const depth = full => relative(location, full).split(sep).length;
    return depth(left) - depth(right) || compareText(left, right);
  });
  for (const file of files.slice(0, 40)) {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const notices = copyrightNotices(text.slice(0, 8000));
    if (!notices.length) continue;
    return { lines: notices, file: relative(location, file).split(sep).join('/') };
  }
  return null;
}

async function apacheLicense(copyrightLines) {
  if (!apacheText) {
    apacheText = normalizeNewlines(await readFile(fileURLToPath(new URL('./standard-licenses/Apache-2.0.txt', import.meta.url)), 'utf8'));
  }
  const pattern = /^([ \t]*)Copyright \[yyyy\] \[name of copyright owner\][ \t]*$/m;
  if (!pattern.test(apacheText)) throw new Error('Apache-2.0 template is missing its copyright placeholder');
  const replaced = apacheText.replace(pattern, match => {
    const indent = match.match(/^\s*/)[0];
    return copyrightLines.map(line => `${indent}${line}`).join('\n');
  });
  const text = `${copyrightLines.join('\n')}\n\n${replaced.trim()}\n`;
  if (COPYRIGHT_PLACEHOLDER.test(text)) throw new Error('Apache-2.0 text still contains a copyright placeholder');
  return text;
}

async function standardLicense(id, copyrightLines) {
  if (id === 'Apache-2.0') return apacheLicense(copyrightLines);
  const template = TEMPLATES.get(id);
  if (!template) throw new Error(`No standard text for license ${id}`);
  const placeholder = /^(?:Copyright \(c\) <year> <copyright holders>|Copyright \(c\) <year> <owner>|Copyright \(C\) YEAR by AUTHOR EMAIL|Copyright <YEAR> <COPYRIGHT HOLDER>)\s*$/m;
  const text = placeholder.test(template)
    ? template.replace(placeholder, copyrightLines.join('\n'))
    : `${copyrightLines.join('\n')}\n\n${template}`;
  if (COPYRIGHT_PLACEHOLDER.test(text)) throw new Error(`${id} text still contains a copyright placeholder`);
  return text;
}

function idsToRender(expression, electedMit) {
  if (electedMit) return ['MIT'];
  const ids = licenseIds(expression).map(canonicalLicense);
  if (!ids.length || ids.some(id => !id)) return null;
  return ids;
}

function licenseFileName(name, version, extra = '') {
  return `${`${name}@${version}${extra}`.replace(/[^A-Za-z0-9._+@-]+/g, '_')}.txt`;
}

async function describePackage(location) {
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read package.json in ${location}: ${error.message}`);
  }
  if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') {
    throw new Error(`Bundled package at ${location} has no name or version`);
  }
  const expression = licenseExpression(pkg);
  const electedMit = electsMit(expression);
  const files = await listLicenseFiles(location);
  const copied = [];
  for (const file of files) {
    const text = normalizeNewlines(await readFile(join(location, file), 'utf8')).trim();
    if (text) copied.push({ file, text });
  }
  const copiedBody = copied.map(item => `${item.file}\n${item.text}`).join('\n\n');
  const copiedCopyright = copied.flatMap(item => copyrightNotices(item.text, Number.POSITIVE_INFINITY));
  let copyright = [...new Set(copiedCopyright)];
  let copyrightSource = copyright.length ? 'upstream license file' : '';
  if (!copyright.length) {
    const found = await findCopyright(location);
    if (found) {
      copyright = found.lines;
      copyrightSource = found.file;
    } else {
      const author = authorNotice(pkg);
      if (author) {
        copyright = [author];
        copyrightSource = 'package.json author';
      }
    }
  }
  if (!copyright.length) throw new Error(`No copyright holder for ${pkg.name}@${pkg.version} (${location})`);

  let body = '';
  let note = '';
  const hasGrant = copied.some(item => textHasGrant(item.text));
  const hasMitGrant = copied.some(item => /permission is hereby granted/i.test(item.text));
  // 选用 MIT 时，包里即使只有 GPL 文本，也要附上 MIT 正文，不能只写一句 election。
  if (hasGrant && (!electedMit || hasMitGrant)) {
    body = copiedCopyright.length ? copiedBody : `${copyright.join('\n')}\n\n${copiedBody}`;
    if (!copiedCopyright.length) note = `Copyright notice taken from ${copyrightSource}.`;
  } else {
    const ids = idsToRender(expression, electedMit);
    if (!ids) throw new Error(`No license text for ${pkg.name}@${pkg.version} (${expression || 'no license field'})`);
    const rendered = [];
    for (const id of ids) rendered.push((await standardLicense(id, copyright)).trim());
    note = `Standard ${ids.join(' AND ')} license text. Copyright notice taken from ${copyrightSource}.`;
    body = rendered.join('\n\n');
    if (copiedBody) body = `${body}\n\n${copiedBody}`;
  }

  const header = [
    `${pkg.name}@${pkg.version}`,
    `License: ${expression || 'custom'}`,
  ];
  if (electedMit) header.push('Election: dsh-jot elects the MIT license.');
  header.push(`Source: https://www.npmjs.com/package/${pkg.name}`);
  const repo = repositoryUrl(pkg);
  if (repo) header.push(`Repository: ${repo}`);
  if (note) header.push(note);
  const document = `${header.join('\n')}\n\n${body.trim()}\n`;
  if (!noticeCoversPackage(document)) {
    throw new Error(`Incomplete third-party notice for ${pkg.name}@${pkg.version}`);
  }
  return { name: pkg.name, version: pkg.version, expression, electedMit, body: document };
}

function renderMarkdown(packages) {
  const lines = [
    '# Third-party notices',
    '',
    'The published client bundle `lib/client.js` includes the third-party packages below. Minification removes their license comments, so each package\'s copyright notice and license text is reproduced under `LICENSES/`. React and ReactDOM are not bundled; the host provides them. The server entry `lib/index.js` keeps its npm dependencies external.',
    '',
  ];
  if (packages.some(pkg => pkg.electedMit)) {
    lines.push('When a package is dual-licensed and MIT is one of the options, dsh-jot elects the MIT license.', '');
  }
  for (const pkg of packages) {
    const election = pkg.electedMit ? '; MIT elected' : '';
    lines.push(`- \`${pkg.name}@${pkg.version}\` — ${pkg.expression || 'custom'}${election} — [license](LICENSES/${pkg.file})`);
  }
  lines.push(
    '',
    'Noto Sans SC fonts in `assets/fonts` are unmodified official builds under the [SIL Open Font License 1.1](assets/fonts/OFL.txt).',
    '',
    'dsh-jot itself is licensed under the [MIT License](LICENSE).',
    '',
  );
  return lines.join('\n');
}

export async function writeThirdPartyNotices({ inputs, licensesDir, noticesFile }) {
  const described = [];
  for (const location of bundledPackageLocations(inputs)) described.push(await describePackage(location));
  const groups = new Map();
  for (const notice of described) {
    const digest = createHash('sha256').update(notice.body).digest('hex');
    const key = `${notice.name}@${notice.version}\0${digest}`;
    if (!groups.has(key)) groups.set(key, notice);
  }
  const byIdentity = new Map();
  for (const notice of groups.values()) {
    const identity = `${notice.name}@${notice.version}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, []);
    byIdentity.get(identity).push(notice);
  }
  const packages = [];
  for (const list of byIdentity.values()) {
    const multiple = list.length > 1;
    for (const notice of list) {
      const extra = multiple ? `+${createHash('sha256').update(notice.body).digest('hex').slice(0, 8)}` : '';
      packages.push({ ...notice, file: licenseFileName(notice.name, notice.version, extra) });
    }
  }
  packages.sort((left, right) => compareText(left.name, right.name) || compareText(left.version, right.version) || compareText(left.file, right.file));
  const markdown = renderMarkdown(packages);
  const staging = `${licensesDir}.tmp`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    for (const notice of packages) {
      const destination = join(staging, notice.file);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, notice.body);
    }
    await rm(licensesDir, { recursive: true, force: true });
    await mkdir(dirname(licensesDir), { recursive: true });
    await rename(staging, licensesDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  await mkdir(dirname(noticesFile), { recursive: true });
  await writeFile(noticesFile, markdown);
  return { packages, markdown };
}
