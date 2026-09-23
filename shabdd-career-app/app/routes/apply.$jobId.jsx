import { ObjectId } from "mongodb";
import { data, useLoaderData } from "react-router";
import ApplicationForm from "../components/applications/ApplicationForm";
import {
  createApplication,
  getPublishedJobById,
  storeResumeFile,
} from "../models/application.server";

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

export const loader = async ({ params }) => {
  const job = await getPublishedJobById(params.jobId || "");

  if (!job) {
    throw new Response("Job not found", { status: 404 });
  }

  return {
    job: serializeJob(job),
  };
};

export const action = async ({ request, params }) => {
  const job = await getPublishedJobById(params.jobId || "");

  if (!job) {
    return data({ error: "This job is no longer accepting applications." }, { status: 404 });
  }

  const formData = await request.formData();
  const missingField = requiredFields.find((fieldName) => !getText(formData, fieldName));

  if (missingField) {
    return data({ error: "Please complete all required fields." }, { status: 400 });
  }

  const expectedSalary = Number(getText(formData, "expectedSalary"));

  if (!Number.isFinite(expectedSalary) || expectedSalary < 0) {
    return data({ error: "Please enter a valid expected salary." }, { status: 400 });
  }

  const email = getText(formData, "email");

  if (!email.includes("@")) {
    return data({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const availableStart = new Date(getText(formData, "availableStart"));

  if (Number.isNaN(availableStart.getTime())) {
    return data({ error: "Please enter a valid available start date." }, { status: 400 });
  }

  const resume = formData.get("resume");

  if (!isUploadedResume(resume)) {
    return data({ error: "Please upload your resume PDF." }, { status: 400 });
  }

  if (resume.size > maxResumeSize) {
    return data({ error: "Resume exceeds the 5 MB file size limit." }, { status: 400 });
  }

  if (resume.type && resume.type !== "application/pdf") {
    return data({ error: "Resume must be a PDF file." }, { status: 400 });
  }

  if (!resume.name?.toLowerCase().endsWith(".pdf") || !(await hasPdfSignature(resume))) {
    return data({ error: "Resume must be a valid PDF file." }, { status: 400 });
  }

  const resumeFileId = await storeResumeFile(resume, {
    shopId: job.shopId,
    jobId: job._id.toString(),
    applicantEmail: email,
  });

  await createApplication({
    shopId: job.shopId,
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

  return { success: true };
};

export default function ApplyForJob() {
  const { job } = useLoaderData();

  return <ApplicationForm job={job} />;
}

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

function serializeJob(job) {
  return {
    id: job._id.toString(),
    jobTitle: job.jobTitle || "Untitled Job",
    department: job.department || "Not provided",
    employmentType: job.employmentType || "Not provided",
    shiftSchedule: job.shiftSchedule || "Not provided",
    location: job.location || "Not provided",
    jobAddress: job.jobAddress || "",
  };
}
