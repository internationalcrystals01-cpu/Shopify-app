import { Readable } from "node:stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { db, client } from "../mongodb.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const applicationId = params.applicationId || "";

  if (!ObjectId.isValid(applicationId)) {
    throw new Response("Resume not found", { status: 404 });
  }

  await client.connect();

  const application = await db.collection("applications").findOne({
    _id: new ObjectId(applicationId),
    shopId: session.shop,
  });

  if (!application?.resumeFileId) {
    throw new Response("Resume not found", { status: 404 });
  }

  const resumeFileId =
    application.resumeFileId instanceof ObjectId
      ? application.resumeFileId
      : new ObjectId(application.resumeFileId);
  const bucket = new GridFSBucket(db, {
    bucketName: "application_resumes",
  });
  const files = await bucket.find({ _id: resumeFileId }).toArray();
  const file = files[0];

  if (!file) {
    throw new Response("Resume not found", { status: 404 });
  }

  const requestedUrl = new URL(request.url);
  const shouldViewInline = requestedUrl.searchParams.get("view") === "1";
  const rawFilename = String(application.resumeFileName || file.filename || "resume.pdf")
    .replaceAll("\\", "_")
    .replaceAll('"', "");
  const filename = rawFilename.toLowerCase().endsWith(".pdf")
    ? rawFilename
    : `${rawFilename}.pdf`;
  const encodedFilename = encodeURIComponent(filename);
  const downloadStream = bucket.openDownloadStream(resumeFileId);

  return new Response(Readable.toWeb(downloadStream), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${shouldViewInline ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
