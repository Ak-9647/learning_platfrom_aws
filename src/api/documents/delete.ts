import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

export class ValidationError extends Error {}
export class AccessDeniedError extends Error {}

async function deleteS3Prefix(s3: S3Client, bucket: string, prefix: string): Promise<void> {
  if (!bucket) return;
  let continuationToken: string | undefined;
  // paginate and batch delete
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const keys = (listed.Contents || []).map((o) => ({ Key: o.Key! }));
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}

async function deactivateShare(ddb: DynamoDBDocumentClient, tableName: string, documentId: string): Promise<void> {
  if (!tableName) return;
  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { documentId },
      UpdateExpression: 'SET published = :pub, shareToken = :nil, shareableLink = :nil',
      ExpressionAttributeValues: { ':pub': false, ':nil': null },
      ConditionExpression: 'attribute_exists(documentId)',
    })
  ).catch(() => void 0); // ignore if not exists
}

async function deleteRegistryItem(ddb: DynamoDBDocumentClient, tableName: string, documentId: string): Promise<void> {
  if (!tableName) return;
  await ddb.send(
    new DeleteCommand({ TableName: tableName, Key: { documentId } })
  ).catch(() => void 0); // idempotent
}

function extractUser(event: any): string | null {
  return event?.requestContext?.authorizer?.principalId || null;
}

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    const documentId = event?.pathParameters?.documentId;
    if (!documentId) throw new ValidationError('Missing documentId');

    const user = extractUser(event);
    if (!user) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };

    const region = process.env.AWS_REGION || 'us-west-2';
    const s3 = new S3Client({ region });
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

    const rawBucket = process.env.RAW_DOCUMENTS_BUCKET || '';
    const procBucket = process.env.PROCESSED_CONTENT_BUCKET || '';
    const tableName = process.env.DOCUMENT_REGISTRY_TABLE || '';

    // Deactivate links (if exists), then deep delete S3 and registry item
    await deactivateShare(ddb, tableName, documentId).catch(() => void 0);

    // Delete raw and processed content with common prefixes (best-effort)
    const prefixes = [
      `documents/${documentId}/`,
      `${documentId}/`,
    ];
    for (const p of prefixes) {
      await deleteS3Prefix(s3, rawBucket, p).catch(() => void 0);
      await deleteS3Prefix(s3, procBucket, p).catch(() => void 0);
    }

    await deleteRegistryItem(ddb, tableName, documentId).catch(() => void 0);

    // TODO: delete vectors from PGVector if configured (placeholder)

    return { statusCode: 200, body: JSON.stringify({ message: 'Deleted', documentId }) };
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return { statusCode: 400, body: JSON.stringify({ message: err.message }) };
    }
    if (err instanceof AccessDeniedError) {
      return { statusCode: 403, body: JSON.stringify({ message: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
}
