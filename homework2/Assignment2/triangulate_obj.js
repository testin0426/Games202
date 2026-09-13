// triangulate_obj.js
// Convert all faces (quads / polygons) to triangles using fan triangulation.
// Usage: node triangulate_obj.js <input.obj> <output.obj>
const fs = require('fs');

const input = process.argv[2];
const output = process.argv[3] || input;

const lines = fs.readFileSync(input, 'utf8').split(/\r?\n/);
const result = [];

for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('f ')) {
        result.push(line);
        continue;
    }
    const tokens = t.split(/\s+/).slice(1); // index refs like 1/2/3
    if (tokens.length === 3) {
        result.push(line);
        continue;
    }
    // fan: (0, i, i+1)
    for (let i = 1; i < tokens.length - 1; i++) {
        result.push('f ' + tokens[0] + ' ' + tokens[i] + ' ' + tokens[i + 1]);
    }
}

fs.writeFileSync(output, result.join('\n'), 'utf8');
console.log('done:', result.length, 'lines ->', output);
