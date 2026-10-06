import fs from "fs";
import path from "path";
import { searchDocs } from "./search";

interface QAPair {
  question: string;
  expected_source_file: string;
}

async function main() {
  const qaPath = path.join(__dirname, "../eval/qa-pairs.json");
  const pairs: QAPair[] = JSON.parse(fs.readFileSync(qaPath, "utf-8"));

  let correct = 0;
  const results: any[] = [];

  for (const pair of pairs) {
    const topResults = await searchDocs(pair.question, 5); // top-5
    const found = topResults.some(
      (r) => r.source_file === pair.expected_source_file
    );
    if (found) correct++;

    results.push({
      question: pair.question,
      expected: pair.expected_source_file,
      found,
      top_sources: topResults.map((r) => r.source_file),
    });
  }

  const precision = (correct / pairs.length) * 100;
  console.log(`\nPrecision@5: ${correct}/${pairs.length} = ${precision.toFixed(1)}%\n`);
  fs.writeFileSync(
    path.join(__dirname, "../eval/results.json"),
    JSON.stringify({ precision, results }, null, 2)
  );
}

main().catch(console.error);