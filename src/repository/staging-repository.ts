import {
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import r2Client, { R2_BUCKET } from "@/lib/r2";
import StagingStorageException from "@/exceptions/staging-storage-exception";

const STAGING_PREFIX = "staging/";

export class StagingRepository {
  async putOrder(orderId: string, body: string): Promise<string> {
    const key = `${STAGING_PREFIX}${orderId}.json`;
    try {
      await r2Client.send(
        new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: "application/json" }),
      );
    } catch (error) {
      throw new StagingStorageException(`Failed to stage order ${orderId}: ${error}`);
    }
    return key;
  }

  async listStagedKeys(): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    try {
      do {
        const page = await r2Client.send(
          new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: STAGING_PREFIX,
            ContinuationToken: continuationToken,
          }),
        );
        for (const obj of page.Contents ?? []) {
          if (obj.Key) keys.push(obj.Key);
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (error) {
      throw new StagingStorageException(`Failed to list staged orders: ${error}`);
    }
    return keys;
  }

  async getObject(key: string): Promise<string> {
    try {
      const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      return await res.Body!.transformToString();
    } catch (error) {
      throw new StagingStorageException(`Failed to read staged object ${key}: ${error}`);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (error) {
      throw new StagingStorageException(`Failed to delete staged object ${key}: ${error}`);
    }
  }
}
