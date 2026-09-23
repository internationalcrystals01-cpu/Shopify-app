import { ObjectId } from "mongodb";
import {
  createApplication,
  getPublishedJobByIdForShop,
  storeResumeFile,
} from "../models/application.server";
import { authenticate } from "../shopify.server";

const maxResumeSize = 5 * 1024 * 1024;
const requiredFields = [
  "fullName",
  "email",
  "phone",
  "experience",
  "qualification",
  "availableStart",
  "expectedSalary",
  "skills",
  "consent",
];

export const action = async ({ request, params }) => {
  const context = await authenticate.public.appProxy(request);
  const shopId = context.session?.shop || new URL(request.url).searchParams.get("shop");
  const job = await getPublishedJobByIdForShop(params.jobId || "", shopId);

  if (!job) {
    return jsonResponse(
      { error: "This job is no longer accepting applications." },
      404,
    );
  }

  const formData = await request.formData();
  const missingField = requiredFields.find((fieldName) => !getText(formData, fieldName));

  if (missingField) {
    return jsonResponse({ error: "Please complete all required fields." }, 400);
  }

  const expectedSalary = Number(getText(formData, "expectedSalary"));

  if (!Number.isFinite(expectedSalary) || expectedSalary < 0) {
    return jsonResponse({ error: "Please enter a valid expected salary." }, 400);
  }

  const email = getText(formData, "email");

  if (!email.includes("@")) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400);
  }

  const availableStart = new Date(getText(formData, "availableStart"));

  if (Number.isNaN(availableStart.getTime())) {
    return jsonResponse(
      { error: "Please enter a valid available start date." },
      400,
    );
  }

  const resume = formData.get("resume");

  if (!isUploadedResume(resume)) {
    return jsonResponse({ error: "Please upload your resume PDF." }, 400);
  }

  if (resume.size > maxResumeSize) {
    return jsonResponse(
      { error: "Resume exceeds the 5 MB file size limit." },
      400,
    );
  }

  if (resume.type && resume.type !== "application/pdf") {
    return jsonResponse({ error: "Resume must be a PDF file." }, 400);
  }

  if (!resume.name?.toLowerCase().endsWith(".pdf") || !(await hasPdfSignature(resume))) {
    return jsonResponse({ error: "Resume must be a valid PDF file." }, 400);
  }

  const resumeFileId = await storeResumeFile(resume, {
    shopId,
    jobId: job._id.toString(),
    applicantEmail: email,
  });

  const applicationId = await createApplication({
    shopId,
    jobId: new ObjectId(job._id),
    fullName: getText(formData, "fullName"),
    email,
    phone: getText(formData, "phone"),
    currentCity: getText(formData, "currentCity"),
    linkedin: getText(formData, "linkedin"),
    experience: getText(formData, "experience"),
    qualification: getText(formData, "qualification"),
    availableStart,
    expectedSalary,
    salaryType: getText(formData, "salaryType") || "Per Month",
    skills: getText(formData, "skills")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
    resumeFileId,
    resumeFileName: resumeFileId ? resume.name || "resume.pdf" : "",
    resumeFileSize: resumeFileId ? resume.size || 0 : 0,
    resumeContentType: resumeFileId ? resume.type || "application/pdf" : "",
  });

  return jsonResponse({
    success: true,
    applicationId: applicationId.toString(),
  });
};

function getText(formData, fieldName) {
  return String(formData.get(fieldName) || "").trim();
}

function isUploadedResume(file) {
  return Boolean(file && typeof file === "object" && "size" in file && file.size > 0);
}

async function hasPdfSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());

  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
