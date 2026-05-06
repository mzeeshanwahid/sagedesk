import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { chunkKnowledge } from './chunker.js';
import { BuilderEmbedder } from './builder-embedder.js';
import { writeIndex, formatBytes } from './writer.js';
import type { KnowledgeFile, IndexChunk, SageDeskModel } from '../core/types.js';

const program = new Command();

program
  .name('sagedesk')
  .description('sagedesk — local RAG support widget build tool')
  .version('1.0.0');

export async function buildAction(options: {
  input: string;
  output: string;
  minScore: string;
  model?: string;
  verbose: boolean;
}) {
  const inputPath = resolve(options.input);
  const outputPath = resolve(options.output);
  const minScore = parseFloat(options.minScore);
  const modelName = (options.model ?? 'all-MiniLM-L6-v2') as SageDeskModel;

  console.log('');
  console.log(chalk.bold('sagedesk') + ' — building vector index');
  console.log('');

  // Read and validate knowledge file
  let knowledgeFile: KnowledgeFile;
  try {
    const raw = readFileSync(inputPath, 'utf-8');
    knowledgeFile = JSON.parse(raw) as KnowledgeFile;
  } catch (err) {
    console.error(chalk.red('✖ Invalid knowledge file:'), String(err));
    process.exit(1);
  }

  if (!knowledgeFile.knowledge || !Array.isArray(knowledgeFile.knowledge)) {
    console.error(chalk.red('✖ Invalid knowledge file: missing "knowledge" array'));
    process.exit(1);
  }

  if (knowledgeFile.knowledge.length === 0) {
    console.error(chalk.red('✖ Knowledge file has no entries'));
    process.exit(1);
  }

  console.log(chalk.dim('  Input:  ') + inputPath);
  console.log(chalk.dim('  Output: ') + outputPath);
  console.log(chalk.dim('  Model:  ') + modelName);
  console.log(chalk.dim('  Entries:') + ' ' + knowledgeFile.knowledge.length);
  console.log('');

  // Chunk the knowledge entries
  let rawChunks: ReturnType<typeof chunkKnowledge>;
  try {
    rawChunks = chunkKnowledge(knowledgeFile);
  } catch (err) {
    console.error(chalk.red('✖ Chunking failed:'), String(err));
    process.exit(1);
  }

  console.log(chalk.dim(`  Chunks: ${rawChunks.length} total`));

  if (options.verbose) {
    rawChunks.forEach((c, i) => {
      console.log(
        chalk.dim(
          `  [${i + 1}/${rawChunks.length}] ${c.id} — "${c.text.slice(0, 60)}..."`
        )
      );
    });
  }

  console.log('');

  // Load the embedding model
  const modelSpinner = ora(`Loading embedding model (${modelName})…`).start();
  const embedder = new BuilderEmbedder(modelName);

  try {
    await embedder.load();
    modelSpinner.succeed(`Embedding model loaded (${modelName})`);
  } catch (err) {
    modelSpinner.fail('Failed to load embedding model');
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  console.log('');

  // Embed all chunks — embed the query text if present, otherwise the answer text
  const embedSpinner = ora(`Embedding ${rawChunks.length} chunks…`).start();
  const indexChunks: IndexChunk[] = [];

  try {
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      embedSpinner.text = `Embedding chunk ${i + 1} / ${rawChunks.length} — ${chunk.id}`;

      // Prefer embedding the query variation; fall back to the answer text
      const textToEmbed = chunk.question ?? chunk.text;
      const vector384 = await embedder.embed(textToEmbed);

      indexChunks.push({
        id: chunk.id,
        sourceId: chunk.sourceId,
        text: chunk.text,
        vector384,
        ...(chunk.question ? { question: chunk.question } : {}),
      });
    }

    embedSpinner.succeed(`Embedded ${rawChunks.length} chunks`);
  } catch (err) {
    embedSpinner.fail('Embedding failed');
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // Write output with model metadata
  const writeSpinner = ora('Writing index file…').start();
  try {
    const dimensions = indexChunks[0]?.vector384.length;
    writeIndex(outputPath, {
      meta: {
        model: modelName,
        builtAt: new Date().toISOString(),
        version: 2,
        dimensions,
      },
      chunks: indexChunks,
    });
    const bytes = statSync(outputPath).size;
    writeSpinner.succeed(
      `Index written → ${outputPath} (${formatBytes(bytes)})`
    );
  } catch (err) {
    writeSpinner.fail('Failed to write output');
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.green('✔ Build complete'));
  console.log(
    chalk.dim(
      `  ${rawChunks.length} chunks from ${knowledgeFile.knowledge.length} entries | model: ${modelName} | minScore default: ${minScore}`
    )
  );
  console.log('');
}

program
  .command('build')
  .description('Build the vector index from a knowledge JSON file')
  .requiredOption('-i, --input <path>', 'Path to knowledge JSON file')
  .option(
    '-o, --output <path>',
    'Output path for index JSON',
    './public/support-index.json'
  )
  .option(
    '--model <name>',
    'Embedding model (all-MiniLM-L6-v2 | bge-small-en-v1-5 | paraphrase-multilingual-MiniLM-L12-v2 | all-mpnet-base-v2)',
    'all-MiniLM-L6-v2'
  )
  .option(
    '--minScore <number>',
    'Default confidence threshold written to index metadata',
    '0.42'
  )
  .option('--verbose', 'Print chunk details during build', false)
  .action(buildAction);

// Only parse if run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('cli/index.js') ||
  process.argv[1].endsWith('cli/index.cjs') ||
  process.argv[1].endsWith('sagedesk')
);

if (isDirectRun) {
  program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('✖ CLI Error:'), err);
    process.exit(1);
  });
}

export { program };
