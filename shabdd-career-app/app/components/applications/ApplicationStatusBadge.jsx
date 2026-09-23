/* eslint-disable react/prop-types */

const statusTone = {
  New: "new",
  Shortlist: "shortlist",
  Shortlisted: "shortlist",
  Interview: "interview",
  Phone: "phone",
  Face: "face",
  Test: "test",
  Final: "final",
  Hired: "hired",
  Rejected: "rejected",
};

export default function ApplicationStatusBadge({ status }) {
  const tone = statusTone[status] || "default";

  return <span className={`application-status ${tone}`}>{status}</span>;
}
