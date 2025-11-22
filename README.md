Learning Content Ingestor

This tool takes raw learning material (notes, transcripts, PDFs converted to text) and turns it into structured study aids:
	•	A learning path (modules + summaries + key concepts)
	•	A set of flashcards (JSON + CSV)
	•	A simple concept graph showing how ideas relate

 How to Use
 1. Place your content in the input/ folder
 Example:
 input/
  sample.txt  ##"(The file can be .txt or .md.)"

  2. Run the ingestor
  node src/index.js input/sample.txt

  3. Find results in the output/ folder

What the Tool Does
Breaks the content into logical “sections”

Blank lines divide sections → each becomes a module.

Extracts important concepts

Using:
	•	unigram frequency
	•	bigram frequency (weighted higher)
	•	stopword filtering
	•	co-occurrence scoring

Builds a learning path

Each module includes:
	•	a short title
	•	a summary
	•	the key concepts found inside it
	•	an order index

Generates flashcards

Each flashcard is a definition-style Q/A based on sentences that mention that concept.

Creates a simple concept graph

If two concepts appear in the same section, they get connected.







  Author

Deepak Gajula
GitHub: https://github.com/Gajula-Deepak