import { getPublishedJobByIdForShop } from "../models/application.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const context = await authenticate.public.appProxy(request);
  const shopId = context.session?.shop || new URL(request.url).searchParams.get("shop");
  const job = await getPublishedJobByIdForShop(params.jobId || "", shopId);

  if (!job) {
    return jsonResponse({ error: "Job not found." }, 404);
  }

  return jsonResponse({
    job: {
      id: job._id.toString(),
      jobTitle: job.jobTitle || "Untitled Job",
      department: job.department || "Not provided",
      employmentType: job.employmentType || "Not provided",
      shiftSchedule: job.shiftSchedule || "Not provided",
      location: job.location || "Not provided",
      jobAddress: job.jobAddress || "",
      numberOfOpenings: job.numberOfOpenings || 1,
      jobDescription: job.jobDescription || "",
      jobResponsibilities: job.jobResponsibilities || "",
      minimumSalary: job.minimumSalary || null,
      maximumSalary: job.maximumSalary || null,
      paymentType: job.paymentType || "",
      currency: job.currency || "INR",
      benefits: job.benefits || "",
      qualification: job.qualification || "",
      workExperience: job.workExperience || "",
      primaryRequirements: job.primaryRequirements || "",
      preferredRequirements: job.preferredRequirements || "",
      additionalNotes: job.additionalNotes || "",
      salaryType: job.paymentType || "Per Month",
    },
  });
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
