import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommandOutput,
} from '@aws-sdk/client-textract';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TextractFallbackOptions {
  region: string;
  bucket: string;
  keyPrefix: string; // e.g., textract/uploads/
  maxWaitMs?: number; // default 120000
  pollIntervalMs?: number; // default 2000
}

export async function extractTextWithTextract(
  pdfBuffer: Buffer,
  documentId: string,
  options: TextractFallbackOptions
): Promise<string[]> {
  const { region, bucket, keyPrefix, maxWaitMs = 120000, pollIntervalMs = 2000 } = options;

  const s3 = new S3Client({ region });
  const textract = new TextractClient({ region });

  const s3Key = `${keyPrefix.replace(/\/$/, '')}/${documentId}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );

  const start = await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: s3Key } },
    })
  );
  const jobId = start.JobId;
  if (!jobId) {
    throw new Error('Textract did not return a JobId');
  }

  const deadline = Date.now() + maxWaitMs;
  let jobStatus = 'IN_PROGRESS';
  let nextToken: string | undefined;

  // Poll until SUCCEEDED/FAILED/TIMEOUT
  const pages: GetDocumentTextDetectionCommandOutput[] = [];
  while (Date.now() < deadline && jobStatus === 'IN_PROGRESS') {
    await sleep(pollIntervalMs);
    const out = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken })
    );
    if (out.JobStatus) jobStatus = out.JobStatus;
    if (out.Blocks && out.Blocks.length) {
      pages.push(out);
    }
    nextToken = out.NextToken;
    if (!nextToken && jobStatus === 'SUCCEEDED') break;
  }

  if (jobStatus !== 'SUCCEEDED') {
    throw new Error(`Textract job did not succeed (status=${jobStatus})`);
  }

  // Extract LINE blocks into text lines
  const lines: string[] = [];
  for (const page of pages) {
    for (const block of page.Blocks ?? []) {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text);
      }
    }
  }

  return lines;
}
