import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, type Dirent } from 'fs';
import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { lookup as mimeLookup } from 'mime-types';
import fs from 'fs/promises';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const CONCURRENCY = 10

export async function uploadDirectoryToS3(localDir: string, s3Prefix: number, bucket: string): Promise<boolean> {
    const files = await getAllFiles(localDir)

    try {
    for (let i = 0; i < files.length; i+=CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY)
        await Promise.all(batch.map((file: string) => uploadFile(file, localDir, s3Prefix, bucket)))
    }
    return true 
    } catch (e) {
        console.log(e);
        return false
    }
}

async function uploadFile(filePath: string, baseDir: string, s3Prefix: number, bucket: string) {
    const relativePath = path.relative(baseDir, filePath)
    const s3Key = `${s3Prefix}/${relativePath}`.replace(/\\/g, '/')
    const contentType = mimeLookup(filePath) || 'application/octet-stream'
    const fileBuffer = await readFile(filePath)

    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        ContentLength: fileBuffer.length,
        CacheControl: filePath.endsWith('.html') ? 'no-cache' : 'max-age=31536000',
    }))
}



async function getAllFiles(dir: string): Promise<string[]> {
    const entries: Dirent[] = await readdir(dir, { withFileTypes: true });
    const files: (string | string[])[] = await Promise.all(
        entries.map((entry: Dirent): Promise<string[]> | string => {
            const fullPath: string = path.join(dir, entry.name);
            return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
        })
    );
    return files.flat();
}