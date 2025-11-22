const fs = require('fs');
const path = require('path');

function readInputFile(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Input file not found: ${absPath}`);
    process.exit(1);
  }

  // Simple text-based ingestion
  // You can generate this text from PDFs or videos using external tools.
  return fs.readFileSync(absPath, "utf-8");
}

function splitIntoSections(text) {
  // Treat blank lines as section breaks
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractConcepts(sections) {
  // Very lightweight NLP-ish scoring using unigrams + bigrams
  const stopwords = new Set([
    'the','a','an','and','or','of','to','in','on','for','is','are','with','by',
    'this','that','it','as','at','from','be','was','were','can','will','we',
    'you','they','their','our','your','also','into','about','what','how',
    'when','where','why','which','who','whom','than','then','there','here'
  ]);

  const fullText = sections.join(' ').toLowerCase();

  const tokens = fullText
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopwords.has(t) && !/^\d+$/.test(t));

  const unigramFreq = {};
  for (const t of tokens) {
    unigramFreq[t] = (unigramFreq[t] || 0) + 1;
  }

  const bigramFreq = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + ' ' + tokens[i + 1];
    if (bigramFreq[bigram]) bigramFreq[bigram]++;
    else bigramFreq[bigram] = 1;
  }

  const scored = [];

  // Single-word terms
  for (const [term, count] of Object.entries(unigramFreq)) {
    scored.push({ term, score: count, kind: 'unigram' });
  }

  // Two-word phrases, give them a bit more weight
  for (const [term, count] of Object.entries(bigramFreq)) {
    if (count < 2) continue; // ignore one-off bigrams
    scored.push({ term, score: count * 2, kind: 'bigram' });
  }

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedWords = new Set();

  // Prefer bigrams (multi-word concepts)
  for (const item of scored) {
    if (selected.length >= 20) break;
    const words = item.term.split(' ');
    const overlaps = words.some((w) => usedWords.has(w));
    if (item.kind === 'bigram' && !overlaps) {
      selected.push(item.term);
      words.forEach((w) => usedWords.add(w));
    }
  }

  // Fill the rest with unigrams that aren't already covered
  for (const item of scored) {
    if (selected.length >= 30) break;
    if (item.kind !== 'unigram') continue;
    if (!selected.includes(item.term)) {
      selected.push(item.term);
    }
  }

  return selected;
}

function buildLearningPath(sections, concepts) {
  // Each section becomes a "module" with a title, summary, and key concepts
  return sections.map((sec, index) => {
    const sentences = sec.split(/(?<=[.!?])\s+/);
    let title = sentences[0] || `Module ${index + 1}`;
    title = title.trim();
    if (title.length > 80) {
      title = title.slice(0, 77) + '...';
    }

    const lowerSec = sec.toLowerCase();
    const keyConcepts = concepts
      .filter((c) => lowerSec.includes(c.toLowerCase()))
      .slice(0, 5);

    const summary =
      sec.length > 280 ? sec.slice(0, 277).trimEnd() + '...' : sec;

    return {
      id: `module-${index + 1}`,
      title,
      summary,
      keyConcepts,
      order: index + 1,
    };
  });
}

function buildFlashcards(sections, concepts) {
  const text = sections.join('\n\n');

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const cards = [];

  for (const concept of concepts) {
    const lowerConcept = concept.toLowerCase();
    const sentence = sentences.find((s) =>
      s.toLowerCase().includes(lowerConcept)
    );

    if (sentence) {
      const question = `What is ${concept}?`;
      cards.push({
        concept,
        question,
        answer: sentence,
        type: 'definition',
      });
    }
  }

  return cards;
}

function buildConceptGraph(sections, concepts) {
  const nodes = concepts.map((c) => ({ id: c, label: c }));
  const edges = [];

  // Co-occurrence: if two concepts appear in the same section, connect them
  const sectionConcepts = sections.map((sec) => {
    const lower = sec.toLowerCase();
    return concepts.filter((c) => lower.includes(c.toLowerCase()));
  });

  const seenPairs = new Set();

  for (const list of sectionConcepts) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        edges.push({
          from: a,
          to: b,
          type: 'co_occurs',
        });
      }
    }
  }

  return { nodes, edges };
}

function writeJsonOutput(fileName, data) {
  const outPath = path.join(__dirname, '..', 'output', fileName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Wrote ${fileName}`);
}

function writeCsvOutput(fileName, cards) {
  const headers = ['concept', 'question', 'answer'];
  const lines = [headers.join(',')];

  for (const card of cards) {
    const row = [card.concept, card.question, card.answer].map((field) => {
      const text = String(field).replace(/"/g, '""');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text}"`;
      }
      return text;
    });

    lines.push(row.join(','));
  }

  const outPath = path.join(__dirname, '..', 'output', fileName);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`✅ Wrote ${fileName}`);
}

async function main() {
  const [, , inputArg] = process.argv;
  if (!inputArg) {
    console.error('Usage: node src/index.js input/myfile.txt');
    process.exit(1);
  }

  const text = await readInputFile(inputArg);
  const sections = splitIntoSections(text);
  const concepts = extractConcepts(sections);
  const learningPath = buildLearningPath(sections, concepts);
  const flashcards = buildFlashcards(sections, concepts);
  const conceptGraph = buildConceptGraph(sections, concepts);

  writeJsonOutput('learning-path.json', learningPath);
  writeJsonOutput('flashcards.json', flashcards);
  writeJsonOutput('concept-graph.json', conceptGraph);
  writeCsvOutput('flashcards.csv', flashcards);
}

main();