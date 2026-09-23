import { getPublishedJobsForShop } from "../models/application.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const context = await authenticate.public.appProxy(request);
  const shopId = context.session?.shop || new URL(request.url).searchParams.get("shop");
  const jobs = await getPublishedJobsForShop(shopId);

  return jsonResponse({
    jobs: jobs.map((job) => ({
      id: job._id.toString(),
      jobTitle: job.jobTitle || "Untitled Job",
      department: job.department || "Not provided",
      employmentType: job.employmentType || "Not provided",
      shiftSchedule: job.shiftSchedule || "Not provided",
      location: job.location || "Not provided",
      jobAddress: job.jobAddress || "",
      numberOfOpenings: job.numberOfOpenings || 1,
      jobDescription: job.jobDescription || "",
    })),
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
