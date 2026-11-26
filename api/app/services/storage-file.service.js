'use strict';

/**
 * The only module that knows the storage vendor. Everything upstream deals in
 * "a key and a bucket", so swapping S3 for R2 for MinIO is a change here.
 */
export const StorageFileService = ({ env, Logger, storage, getSignedUrl }) => {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = storage;

  const { accessKeyId, secretAccessKey, endpoint, region, signedUrlTtl } = env.storage;

  const configured = Boolean(accessKeyId && secretAccessKey);

  // Building the client eagerly would throw at import time in a deployment that
  // does not use storage at all. Build it on first use instead.
  let client = null;

  const getClient = () => {
    if (!configured) {
      throw new ReferenceError('Storage is not configured: STORAGE_ACCESS_KEY_ID is missing');
    }
    if (!client) {
      client = new S3Client({
        region,
        ...(endpoint && { endpoint }),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
    return client;
  };

  const upload = async ({ bucket, key, body, contentType }) => {
    Logger.verbose(`StorageFileService::upload - ${bucket}/${key}`);
    await getClient().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
    );
    return { bucket, key };
  };

  const getSignedURL = ({ bucket, key }) =>
    getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: signedUrlTtl,
    });

  const remove = ({ bucket, key }) =>
    getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  return { getSignedURL, isConfigured: () => configured, remove, upload };
};
