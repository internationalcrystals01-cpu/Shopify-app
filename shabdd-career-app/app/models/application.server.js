import { Buffer } from "node:buffer";
import { GridFSBucket, ObjectId } from "mongodb";
import { client, db } from "../mongodb.server";

export const applicationStatuses = [
  "unlisted",
  "shortlist",
  "phone",
  "face",
  "test",
  "final",
  "hired",
  "rejected",
];

export async function createApplication(applicationData) {
  await client.connect();

  const now = new Date();
  const result = await db.collection("applications").insertOne({
    ...applicationData,
    status: "unlisted",
    statusHistory: [
      {
        status: "applied",
        changedAt: now,
      },
    ],
    resumeFileId: applicationData.resumeFileId || null,
    createdAt: now,
    updatedAt: now,
  });

  return result.insertedId;
}

export async function storeResumeFile(file, metadata = {}) {
  await client.connect();

  const bucket = new GridFSBucket(db, {
    bucketName: "application_resumes",
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const rawFilename = String(file.name || "resume.pdf")
    .replaceAll("\\", "_")
    .replaceAll('"', "");
  const filename = rawFilename.toLowerCase().endsWith(".pdf")
    ? rawFilename
    : `${rawFilename}.pdf`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: "application/pdf",
      metadata,
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

export async function getPublishedJobById(jobId) {
  if (!ObjectId.isValid(jobId)) {
    return null;
  }

  await client.connect();

  return db.collection("jobs").findOne({
    _id: new ObjectId(jobId),
    status: "published",
  });
}

export async function getPublishedJobByIdForShop(jobId, shopId) {
  if (!ObjectId.isValid(jobId) || !shopId) {
    return null;
  }

  await client.connect();

  return db.collection("jobs").findOne({
    _id: new ObjectId(jobId),
    shopId,
    status: "published",
  });
}

export async function getPublishedJobsForShop(shopId) {
  if (!shopId) {
    return [];
  }

  await client.connect();

  return db
    .collection("jobs")
    .find({
      shopId,
      status: "published",
    })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getApplicationsForShop(shopId) {
  if (!shopId) {
    return [];
  }

  await client.connect();

  return db
    .collection("applications")
    .aggregate([
      {
        $match: {
          shopId,
        },
      },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      {
        $unwind: {
          path: "$job",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ])
    .toArray();
}
