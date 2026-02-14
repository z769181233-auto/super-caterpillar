const mammoth = require('mammoth');
const fs = require('fs');

async function extract() {
  const filePath = 'docs/novels/source/BOOK.docx';
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  console.log(result.value.substring(0, 5000));
}

extract().catch((err) => console.error(err));
