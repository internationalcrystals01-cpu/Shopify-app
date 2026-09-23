import { ObjectId } from "mongodb";
import { useMemo, useState } from "react";
import {
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import { client, db } from "../mongodb.server";

const statuses = ["published", "expired", "paused", "draft"];
const filterTabs = [
  ["all", "All Jobs"],
  ["published", "Published"],
  ["expired", "Expired"],
  ["paused", "Paused"],
  ["draft", "Draft"],
];

function matchesJobSearch(job, searchText) {
  if (!searchText) {
    return true;
  }

  const values = [
    job.jobTitle,
    job.department,
    job.status,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const words = values.flatMap((value) =>
    value.split(/[\s,/-]+/).filter(Boolean),
  );
  const initials = words.map((word) => word[0]).join("");

  return (
    values.some((value) => value.startsWith(searchText)) ||
    words.some((word) => word.startsWith(searchText)) ||
    initials.startsWith(searchText)
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  await client.connect();

  const jobs = await db
    .collection("jobs")
    .find({ shopId: session.shop })
    .sort({ createdAt: -1 })
    .toArray();

  const applicationCounts = await db
    .collection("applications")
    .aggregate([
      {
        $match: {
          shopId: session.shop,
        },
      },
      {
        $group: {
          _id: {
            jobId: "$jobId",
            status: "$status",
          },
          count: {
            $sum: 1,
          },
        },
      },
    ])
    .toArray();

  const countsByJobId = applicationCounts.reduce((counts, item) => {
    const jobId = item._id.jobId?.toString();

    if (!jobId) {
      return counts;
    }

    const status = item._id.status || "unlisted";
    const currentCounts =
      counts.get(jobId) || {
        applicants: 0,
        inProgress: 0,
        rejected: 0,
        hired: 0,
      };

    currentCounts.applicants += item.count;

    if (["shortlist", "phone", "face", "test", "final"].includes(status)) {
      currentCounts.inProgress += item.count;
    }

    if (status === "rejected") {
      currentCounts.rejected += item.count;
    }

    if (status === "hired") {
      currentCounts.hired += item.count;
    }

    counts.set(jobId, currentCounts);
    return counts;
  }, new Map());

  return {
    jobs: jobs.map((job) => {
      const jobId = job._id.toString();
      const counts =
        countsByJobId.get(jobId) || {
          applicants: 0,
          inProgress: 0,
          rejected: 0,
          hired: 0,
        };

      return {
        id: jobId,
        jobTitle: job.jobTitle || "Untitled Job",
        department: job.department || "Not provided",
        applicationDeadline: job.applicationDeadline
          ? job.applicationDeadline.toISOString()
          : null,
        status: job.status || "draft",
        applicants: counts.applicants,
        inProgress: counts.inProgress,
        rejected: counts.rejected,
        hired: counts.hired,
      };
    }),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const jobId = String(formData.get("jobId") || "");
  const status = String(formData.get("status") || "");

  if (!["delete-job", "update-status"].includes(intent)) {
    return null;
  }

  if (!ObjectId.isValid(jobId)) {
    return null;
  }

  await client.connect();

  if (intent === "update-status") {
    if (!statuses.includes(status)) {
      return null;
    }

    await db.collection("jobs").updateOne(
      {
        _id: new ObjectId(jobId),
        shopId: session.shop,
      },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    );

    return redirect("/app/job-list");
  }

  await db.collection("jobs").deleteOne({
    _id: new ObjectId(jobId),
    shopId: session.shop,
  });

  return redirect("/app/job-list");
};

export default function JobList() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const { jobs } = useLoaderData();
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  const isSubmitting = navigation.state === "submitting";

  const filteredJobs = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesStatus =
        activeStatus === "all" || job.status === activeStatus;
      const matchesSearch = matchesJobSearch(job, searchText);

      return matchesStatus && matchesSearch;
    });
  }, [activeStatus, jobs, search]);

  const statusCounts = useMemo(() => {
    return statuses.reduce(
      (counts, status) => ({
        ...counts,
        [status]: jobs.filter((job) => job.status === status).length,
      }),
      { all: jobs.length },
    );
  }, [jobs]);

  const deleteJob = () => {
    if (!jobToDelete) {
      return;
    }

    const data = new FormData();
    data.append("intent", "delete-job");
    data.append("jobId", jobToDelete.id);
    setJobToDelete(null);
    setOpenMenuId(null);
    submit(data, { method: "post" });
  };

  const updateJobStatus = (jobId, status) => {
    const data = new FormData();
    data.append("intent", "update-status");
    data.append("jobId", jobId);
    data.append("status", status);
    setOpenMenuId(null);
    submit(data, { method: "post" });
  };

  return (
    <s-page>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .jobs-page {
          width: 100%;
          min-height: 100vh;
          padding: 18px 20px;
          background: #f6f7f8;
        }

        .jobs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .jobs-title {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 700;
          color: #202223;
          white-space: nowrap;
        }

        .job-tabs {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 6px;
        }

        .job-tab {
          height: 36px;
          padding: 0 13px;
          border: 1px solid #d7d9dc;
          border-radius: 7px;
          background: #ffffff;
          color: #4a4f55;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .job-tab.active {
          background: #dff3ff;
          border-color: #b8e4fb;
          color: #1f4b99;
          font-weight: 600;
        }

        .jobs-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 12px;
          margin-bottom: 16px;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 10px;
        }

        .job-search {
          width: 320px;
          height: 38px;
          padding: 0 12px;
          border: 1px solid #c9cccf;
          border-radius: 7px;
          background: #ffffff;
          color: #202223;
          font-size: 13px;
          outline: none;
        }

        .job-search:focus {
          border-color: #5c6ac4;
        }

        .post-job-btn {
          height: 38px;
          padding: 0 15px;
          border: none;
          border-radius: 7px;
          background: #303030;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .jobs-table-wrapper {
          overflow-x: auto;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 10px;
        }

        .jobs-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        .jobs-table th {
          padding: 12px 14px;
          background: #fafafa;
          border-bottom: 1px solid #e1e3e5;
          color: #616161;
          font-size: 12px;
          font-weight: 600;
          text-align: left;
        }

        .jobs-table td {
          padding: 14px;
          border-bottom: 1px solid #eeeeee;
          color: #303030;
          font-size: 13px;
          vertical-align: middle;
        }

        .job-name {
          margin-bottom: 4px;
          color: #202223;
          font-size: 14px;
          font-weight: 600;
        }

        .job-meta {
          color: #6d7175;
          font-size: 12px;
        }

        .job-date {
          display: block;
          margin-top: 4px;
          color: #8c9196;
          font-size: 11px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 9px;
          border-radius: 20px;
          background: #f1f1f1;
          color: #555;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-badge.published {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.paused {
          background: #fff7d6;
          color: #8a5a00;
        }

        .status-badge.archived {
          background: #eef2f7;
          color: #4b5563;
        }

        .status-badge.expired {
          background: #ffe4e0;
          color: #c5280c;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
        }

        .action-btn,
        .more-btn {
          border: 1px solid #d2d5d8;
          border-radius: 6px;
          background: #ffffff;
          color: #303030;
          cursor: pointer;
        }

        .action-btn {
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 500;
        }

        .more-btn {
          width: 30px;
          height: 30px;
          font-size: 16px;
        }

        .delete-menu {
          position: absolute;
          top: 34px;
          right: 0;
          z-index: 10;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          width: 360px;
          max-width: calc(100vw - 64px);
          padding: 8px;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16);
        }

        .menu-action-btn,
        .delete-btn {
          width: auto;
          height: 32px;
          border: 1px solid #d2d5d8;
          border-radius: 6px;
          background: #ffffff;
          color: #303030;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          padding: 0 12px;
          white-space: nowrap;
        }

        .menu-action-btn:hover {
          background: #f4f6f8;
        }

        .delete-btn {
          border-color: #ffd1cd;
          background: #fff1f0;
          color: #c5280c;
        }

        .delete-btn:hover {
          background: #ffe4e0;
        }

        .delete-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.44);
        }

        .delete-modal {
          width: min(430px, 100%);
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }

        .delete-modal-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 20px 22px 14px;
        }

        .delete-warning-icon {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #fff1f0;
          color: #c5280c;
          font-size: 20px;
          font-weight: 800;
        }

        .delete-modal-title {
          margin: 0;
          color: #202223;
          font-size: 18px;
          font-weight: 750;
          line-height: 24px;
        }

        .delete-modal-text {
          margin: 6px 0 0;
          color: #5f6b7a;
          font-size: 13px;
          line-height: 20px;
        }

        .delete-job-name {
          color: #202223;
          font-weight: 700;
        }

        .delete-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 22px 20px;
          border-top: 1px solid #edf0f3;
          background: #fafbfc;
        }

        .modal-cancel-btn,
        .modal-delete-btn {
          height: 36px;
          padding: 0 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .modal-cancel-btn {
          border: 1px solid #c9cccf;
          background: #ffffff;
          color: #303030;
        }

        .modal-delete-btn {
          border: 0;
          background: #d72c0d;
          color: #ffffff;
        }

        .modal-delete-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .empty-row {
          height: 96px;
          text-align: center;
          color: #6d7175;
        }

        .table-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 20px;
          padding: 12px 14px;
          background: #ffffff;
          color: #6d7175;
          font-size: 12px;
        }

        .per-page {
          padding: 5px 8px;
          border: 1px solid #d2d5d8;
          border-radius: 5px;
          background: #ffffff;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .jobs-page {
            padding: 14px;
          }

          .jobs-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .job-tabs {
            justify-content: flex-start;
          }

          .jobs-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .job-search {
            width: 100%;
          }
        }
      `}</style>

      <div className="jobs-page">
        <div className="jobs-header">
          <h1 className="jobs-title">All Jobs</h1>

          <div className="job-tabs">
            {filterTabs.map(([status, label]) => (
              <button
                key={status}
                type="button"
                className={`job-tab${activeStatus === status ? " active" : ""}`}
                onClick={() => setActiveStatus(status)}
              >
                {label} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>

        <div className="jobs-toolbar">
          <input
            type="text"
            className="job-search"
            placeholder="Search jobs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <button
            type="button"
            className="post-job-btn"
            onClick={() => navigate("/app/create-job")}
          >
            + Post New Job
          </button>
        </div>

        <div className="jobs-table-wrapper">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Applicants</th>
                <th>In Progress</th>
                <th>Rejected</th>
                <th>Hired</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan="7">
                    No jobs found.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="job-name">{job.jobTitle}</div>
                      <div className="job-meta">{job.department}</div>
                      <span className="job-date">
                        {formatJobDate(job.applicationDeadline)}
                      </span>
                    </td>
                    <td>{job.applicants}</td>
                    <td>{job.inProgress}</td>
                    <td>{job.rejected}</td>
                    <td>{job.hired}</td>
                    <td>
                      <span className={`status-badge ${job.status}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() =>
                            navigate(`/app/job-detail?jobId=${job.id}`)
                          }
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          className="action-btn"
                          onClick={() =>
                            navigate(`/app/create-job?jobId=${job.id}`)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="more-btn"
                          onClick={() =>
                            setOpenMenuId(openMenuId === job.id ? null : job.id)
                          }
                        >
                          ...
                        </button>

                        {openMenuId === job.id && (
                          <div className="delete-menu">
                            {job.status !== "published" && (
                              <button
                                type="button"
                                className="menu-action-btn"
                                disabled={isSubmitting}
                                onClick={() =>
                                  updateJobStatus(job.id, "published")
                                }
                              >
                                Publish
                              </button>
                            )}

                            {job.status !== "paused" && (
                              <button
                                type="button"
                                className="menu-action-btn"
                                disabled={isSubmitting}
                                onClick={() => updateJobStatus(job.id, "paused")}
                              >
                                Pause
                              </button>
                            )}

                            {job.status !== "expired" && (
                              <button
                                type="button"
                                className="menu-action-btn"
                                disabled={isSubmitting}
                                onClick={() =>
                                  updateJobStatus(job.id, "expired")
                                }
                              >
                                Mark expired
                              </button>
                            )}

                            {job.status !== "draft" && (
                              <button
                                type="button"
                                className="menu-action-btn"
                                disabled={isSubmitting}
                                onClick={() => updateJobStatus(job.id, "draft")}
                              >
                                Move to draft
                              </button>
                            )}

                            <button
                              type="button"
                              className="delete-btn"
                              disabled={isSubmitting}
                              onClick={() => {
                                setJobToDelete(job);
                                setOpenMenuId(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="table-footer">
            <span>
              Showing {filteredJobs.length}{" "}
              {filteredJobs.length === 1 ? "item" : "items"}
            </span>

            <select className="per-page" defaultValue="10">
              <option value="10">10 Per Page</option>
              <option value="20">20 Per Page</option>
              <option value="50">50 Per Page</option>
            </select>
          </div>
        </div>

        {jobToDelete && (
          <div className="delete-modal-backdrop" role="presentation">
            <section
              className="delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-job-title"
            >
              <div className="delete-modal-header">
                <span className="delete-warning-icon">!</span>

                <div>
                  <h2 className="delete-modal-title" id="delete-job-title">
                    Delete job post?
                  </h2>
                  <p className="delete-modal-text">
                    This will permanently delete{" "}
                    <span className="delete-job-name">
                      {jobToDelete.jobTitle}
                    </span>{" "}
                    from your careers app and MongoDB.
                  </p>
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  disabled={isSubmitting}
                  onClick={() => setJobToDelete(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-delete-btn"
                  disabled={isSubmitting}
                  onClick={deleteJob}
                >
                  {isSubmitting ? "Deleting..." : "Delete job"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </s-page>
  );
}

function formatJobDate(dateValue) {
  if (!dateValue) {
    return "No deadline";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
