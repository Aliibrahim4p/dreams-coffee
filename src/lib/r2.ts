import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = process.env.R2_BUCKET as string;

// No globalForPrisma-style hot-reload guard here: unlike PrismaClient, S3Client isn't a
// stateful connection pool against a connection-limited backend, so an extra instance on
// a dev hot-reload has no equivalent cost.
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export default r2Client;
