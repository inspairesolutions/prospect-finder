import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'

// DO_ENDPOINT = https://inspaire-solutions.lon1.digitaloceanspaces.com
// We parse bucket name and region endpoint from it
const doEndpoint = process.env.DO_ENDPOINT || ''
const urlMatch = doEndpoint.match(/^https?:\/\/(.+?)\.(.+\.digitaloceanspaces\.com)$/)

const bucket = urlMatch ? urlMatch[1] : 'inspaire-solutions'
const regionEndpoint = urlMatch ? `https://${urlMatch[2]}` : 'https://lon1.digitaloceanspaces.com'

export const s3 = new S3Client({
  endpoint: regionEndpoint,
  region: 'lon1',
  credentials: {
    accessKeyId: process.env.DO_ACCESS_KEY || '',
    secretAccessKey: process.env.DO_SECRET_KEY || '',
  },
  forcePathStyle: false,
})

export const BUCKET = bucket
export const CDN_BASE = doEndpoint // public URL base

export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ACL: 'public-read',
      ContentType: contentType || 'application/octet-stream',
    })
  )
  return `${CDN_BASE}/${key}`
}

export async function deleteFromStorage(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

export async function deletePrefix(prefix: string): Promise<void> {
  let continuationToken: string | undefined

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )

    if (list.Contents) {
      await Promise.all(
        list.Contents.map((obj) =>
          obj.Key ? deleteFromStorage(obj.Key) : Promise.resolve()
        )
      )
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (continuationToken)
}
