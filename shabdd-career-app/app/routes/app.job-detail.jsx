import { ObjectId } from "mongodb";
import { useEffect, useState } from "react";
import { data, redirect, useFetcher, useLoaderData, useNavigate } from "react-router";
import { client, db } from "../mongodb.server";
import { authenticate } from "../shopify.server";

const stageIds = [
  "unlisted",
  "shortlist",
  "phone",
  "face",
  "test",
  "final",
  "hired",
  "rejected",
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId || !ObjectId.isValid(jobId)) {
    return redirect("/app/job-list");
  }

  await client.connect();

  const jobObjectId = new ObjectId(jobId);
  const job = await db.collection("jobs").findOne({
    _id: jobObjectId,
    shopId: session.shop,
  });

  if (!job) {
    return redirect("/app/job-list");
  }

  const applications = await db
    .collection("applications")
    .find({
      shopId: session.shop,
      jobId: {
        $in: [jobObjectId, jobId],
      },
    })
    .sort({ createdAt: -1 })
    .toArray();

  const stageCounts = stageIds.reduce(
    (counts, stageId) => ({
      ...counts,
      [stageId]: 0,
    }),
    { all: applications.length },
  );

  applications.forEach((application) => {
    const status = stageIds.includes(application.status)
      ? application.status
      : "unlisted";
    stageCounts[status] += 1;
  });

  return {
    job: {
      title: job.jobTitle || "Untitled Job",
      department: job.department || "Not provided",
      postedDate: formatDate(job.createdAt),
      status: formatStatus(job.status || "draft"),
    },
    stageCounts,
    applicants: applications.map((application) => ({
      id: application._id.toString(),
      name: application.fullName || "Unnamed Applicant",
      status: stageIds.includes(application.status)
        ? application.status
        : "unlisted",
      experience: application.experience || "Not provided",
      expectedSalary:
        typeof application.expectedSalary === "number"
          ? `Rs. ${application.expectedSalary.toLocaleString("en-IN")}`
          : "Not provided",
      applicationDate: formatDate(application.createdAt),
    })),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const applicationId = String(formData.get("applicationId") || "");

  if (
    intent !== "delete-application" ||
    !jobId ||
    !ObjectId.isValid(jobId) ||
    !ObjectId.isValid(applicationId)
  ) {
    return data({ error: "Application could not be deleted." }, { status: 400 });
  }

  await client.connect();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const jobObjectId = new ObjectId(jobId);
  const result = await db.collection("applications").deleteOne({
    _id: new ObjectId(applicationId),
    shopId: session.shop,
    jobId: {
      $in: [jobObjectId, jobId],
    },
  });

  if (result.deletedCount === 0) {
    return data({ error: "Application was not found." }, { status: 404 });
  }

  return { success: true };
};

export default function JobDetail() {
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();
  const { job, stageCounts, applicants } = useLoaderData();

  const [activeStage, setActiveStage] = useState("unlisted");
  const [search, setSearch] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const isDeleting = deleteFetcher.state !== "idle";

  useEffect(() => {
    if (deleteFetcher.data?.success) {
      setDeleteCandidate(null);
      setDeleteSuccessOpen(true);

      const refreshTimer = window.setTimeout(() => {
        window.location.reload();
      }, 2000);

      return () => window.clearTimeout(refreshTimer);
    }
  }, [deleteFetcher.data]);

  const openApplicantDetail = (applicationId) => {
    navigate(`/app/application?applicationId=${applicationId}`);
  };

  const confirmDeleteApplication = () => {
    if (!deleteCandidate || isDeleting) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete-application");
    formData.append("applicationId", deleteCandidate.id);
    deleteFetcher.submit(formData, { method: "post" });
  };

  const stages = [
    {
      id: "unlisted",
      label: "Unlisted",
      count: stageCounts.unlisted,
      icon: "👥",
    },
    {
      id: "shortlist",
      label: "Shortlist",
      count: stageCounts.shortlist,
      icon: "☷",
    },
    {
      id: "phone",
      label: "Phone",
      count: stageCounts.phone,
      icon: "☎",
    },
    {
      id: "face",
      label: "Face",
      count: stageCounts.face,
      icon: "👤",
    },
    {
      id: "test",
      label: "Test",
      count: stageCounts.test,
      icon: "▣",
    },
    {
      id: "final",
      label: "Final",
      count: stageCounts.final,
      icon: "♟",
    },
    {
      id: "hired",
      label: "Hired",
      count: stageCounts.hired,
      icon: "✓",
    },
    {
      id: "rejected",
      label: "Rejected",
      count: stageCounts.rejected,
      icon: "×",
    },
    {
      id: "all",
      label: "All",
      count: stageCounts.all,
      icon: "✦",
    },
  ];

  const filteredApplicants = applicants.filter((applicant) => {
    const matchesSearch = applicant.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStage =
      activeStage === "all" ||
      applicant.status === activeStage;

    return matchesSearch && matchesStage;
  });

  return (
    <s-page>
      <style>{`

        * {
          box-sizing: border-box;
        }

        /* =========================================
           PAGE
        ========================================= */

        .job-detail-page {
          width: 100%;
          min-height: 100vh;
          position: relative;

          padding: 18px 20px 30px;

          background: #f5f7fa;
        }

        .job-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(7, 20, 54, 0.42);
        }

        .job-modal {
          width: min(430px, 100%);
          padding: 28px;
          border: 1px solid #dfe7f2;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 28px 90px rgba(7, 20, 54, 0.28);
          text-align: center;
        }

        .job-modal-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          margin-bottom: 14px;
          border-radius: 50%;
          background: #fff1f2;
          color: #be123c;
          font-size: 24px;
          font-weight: 900;
        }

        .job-modal-icon.success {
          background: #dcfce7;
          color: #15803d;
        }

        .job-modal h2 {
          margin: 0;
          color: #071436;
          font-size: 22px;
          line-height: 28px;
          font-weight: 850;
        }

        .job-modal p {
          margin: 8px 0 22px;
          color: #4b587c;
          font-size: 14px;
          line-height: 21px;
        }

        .job-modal-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
        }

        .job-modal-actions button {
          min-width: 116px;
          height: 40px;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
        }

        .job-modal-actions .danger {
          border-color: #e11d48;
          background: #e11d48;
          color: #ffffff;
        }

        .job-modal-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }


        /* =========================================
           HEADER
        ========================================= */

        .job-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;

          gap: 20px;

          margin-bottom: 20px;
        }

        .job-header-left {
          min-width: 0;
        }

        .job-title-row {
          display: flex;
          align-items: center;

          gap: 10px;
        }

        .back-circle {
          width: 30px;
          height: 30px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border: 1px solid #e1e3e5;
          border-radius: 50%;

          background: #ffffff;

          color: #303030;

          font-size: 16px;

          cursor: pointer;
        }

        .back-circle:hover {
          background: #f1f2f3;
        }

        .job-title {
          margin: 0;

          color: #202223;

          font-size: 22px;
          font-weight: 700;
        }


        /* =========================================
           JOB META
        ========================================= */

        .job-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;

          gap: 14px;

          margin-top: 12px;
          margin-left: 40px;
        }

        .meta-item {
          display: flex;
          align-items: center;

          gap: 5px;

          color: #525861;

          font-size: 12px;
        }

        .meta-icon {
          color: #303030;
        }

        .meta-value {
          color: #596078;
        }

        .published-status {
          color: #18a957;

          font-weight: 600;
        }

        .published-dot {
          width: 11px;
          height: 11px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #2fbd68;

          color: #ffffff;

          font-size: 7px;
        }


        /* =========================================
           HEADER BUTTONS
        ========================================= */

        .header-actions {
          display: flex;
          align-items: center;

          gap: 8px;

          flex-shrink: 0;
        }

        .header-btn {
          height: 36px;

          padding: 0 14px;

          border: 1px solid #c9ced8;
          border-radius: 7px;

          background: #ffffff;

          color: #30375b;

          font-size: 12px;
          font-weight: 600;

          cursor: pointer;
        }

        .header-btn:hover {
          background: #f7f8fa;
        }

        .header-btn.active {
          border-color: #c9eafd;

          background: #d9f1ff;

          color: #243aa5;
        }


        /* =========================================
           PIPELINE
        ========================================= */

        .pipeline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;

          gap: 9px;

          margin-bottom: 24px;
        }

        .pipeline-item-wrapper {
          display: flex;
          align-items: center;

          gap: 8px;
        }

        .pipeline-btn {
          min-width: 140px;
          height: 42px;

          display: flex;
          align-items: center;

          gap: 8px;

          padding: 0 12px;

          border: 1px solid #c9ced8;
          border-radius: 7px;

          background: #ffffff;

          color: #3e4664;

          font-size: 12px;

          cursor: pointer;

          transition: 0.2s ease;
        }

        .pipeline-btn:hover {
          background: #f8f9fb;
        }

        .pipeline-btn.active {
          border-color: #3346bd;

          background: #3346bd;

          color: #ffffff;
        }

        .stage-icon {
          width: 27px;
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 50%;

          background: #6772e5;

          color: #ffffff;

          font-size: 12px;
          font-weight: 700;
        }

        .pipeline-btn.active .stage-icon {
          background: #ffffff;

          color: #3346bd;
        }

        .stage-shortlist {
          background: #ff8a3d;
        }

        .stage-phone {
          background: #ffc400;
        }

        .stage-face {
          background: #8378e8;
        }

        .stage-test {
          background: #1e9dca;
        }

        .stage-final {
          background: #ef8ca5;
        }

        .stage-hired {
          background: #38b96b;
        }

        .stage-rejected {
          background: #ff5b64;
        }

        .stage-all {
          background: #56a7f5;
        }

        .stage-arrow {
          color: #48506b;

          font-size: 17px;
        }


        /* =========================================
           FILTER CARD
        ========================================= */

        .filter-card {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 8px;

          padding: 12px;

          border: 1px solid #edf0f3;
          border-radius: 10px;

          background: #ffffff;
        }

        .search-wrapper {
          position: relative;

          width: 240px;
        }

        .search-icon {
          position: absolute;

          top: 50%;
          left: 11px;

          transform: translateY(-50%);

          color: #697386;

          font-size: 14px;

          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 38px;

          padding: 0 12px 0 34px;

          border: 1px solid #c9ced8;
          border-radius: 7px;

          background: #ffffff;

          color: #303030;

          font-size: 12px;

          outline: none;
        }

        .search-input:focus {
          border-color: #3346bd;

          box-shadow:
            0 0 0 1px #3346bd;
        }

        .date-input {
          width: 190px;
          height: 38px;

          padding: 0 10px;

          border: 1px solid #c9ced8;
          border-radius: 7px;

          background: #ffffff;

          color: #50566b;

          font-size: 12px;

          outline: none;
        }


        /* =========================================
           APPLICANTS TABLE
        ========================================= */

        .applicant-table-card {
          overflow: hidden;

          border: 1px solid #edf0f3;
          border-radius: 9px;

          background: #ffffff;
        }

        .table-scroll {
          overflow-x: auto;
        }

        .applicant-table {
          width: 100%;
          min-width: 900px;

          border-collapse: collapse;
        }

        .applicant-table thead {
          background: #cceeff;
        }

        .applicant-table th {
          height: 43px;

          padding: 0 15px;

          color: #151515;

          font-size: 12px;
          font-weight: 700;

          text-align: left;
        }

        .applicant-table td {
          padding: 13px 15px;

          border-bottom: 1px solid #eeeeee;

          color: #444b56;

          font-size: 12px;
        }


        /* =========================================
           APPLICANT
        ========================================= */

        .applicant-name {
          font-weight: 600;

          color: #202223;
        }

        .preview-btn,
        .delete-applicant-btn {
          padding: 6px 10px;

          border: 1px solid #d2d5d8;
          border-radius: 6px;

          background: #ffffff;

          color: #303030;

          font-size: 11px;

          cursor: pointer;
        }

        .preview-btn:hover,
        .delete-applicant-btn:hover {
          background: #f4f5f6;
        }

        .delete-applicant-btn {
          border-color: #fecdd3;
          color: #be123c;
          font-weight: 700;
        }

        .delete-applicant-btn:hover {
          background: #fff1f2;
        }


        /* =========================================
           EMPTY STATE
        ========================================= */

        .empty-state {
          min-height: 300px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          padding: 40px 20px;

          text-align: center;
        }

        .empty-icon {
          position: relative;

          width: 72px;
          height: 76px;

          margin-bottom: 14px;
        }

        .paper-one,
        .paper-two {
          position: absolute;

          width: 48px;
          height: 62px;

          border: 1.5px solid #536079;

          background: #ffffff;
        }

        .paper-one {
          top: 3px;
          left: 7px;

          transform: rotate(-14deg);
        }

        .paper-two {
          top: 9px;
          left: 20px;
        }

        .paper-line {
          width: 25px;
          height: 4px;

          margin: 12px auto 0;

          border-radius: 3px;

          background: #4a51ae;
        }

        .empty-title {
          margin: 0;

          color: #50566b;

          font-size: 14px;
          font-weight: 600;
        }

        .empty-description {
          margin: 5px 0 0;

          color: #8a8f98;

          font-size: 11px;
        }


        /* =========================================
           RESPONSIVE
        ========================================= */

        @media (max-width: 900px) {

          .job-detail-page {
            padding: 14px;
          }

          .job-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;

            flex-wrap: wrap;
          }

          .job-meta {
            margin-left: 0;
          }

          .pipeline {
            align-items: stretch;
          }

          .pipeline-item-wrapper {
            flex-grow: 1;
          }

          .pipeline-btn {
            flex-grow: 1;
          }

          .filter-card {
            flex-direction: column;
            align-items: stretch;
          }

          .search-wrapper,
          .date-input {
            width: 100%;
          }

        }

      `}</style>


      <div className="job-detail-page">
        {deleteCandidate && (
          <div className="job-modal-overlay" role="dialog" aria-modal="true">
            <div className="job-modal">
              <span className="job-modal-icon" aria-hidden="true">!</span>
              <h2>Delete this application?</h2>
              <p>
                Are you sure you want to delete the application for {deleteCandidate.name}?
                This action cannot be undone.
              </p>
              <div className="job-modal-actions">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteCandidate(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={isDeleting}
                  onClick={confirmDeleteApplication}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteSuccessOpen && (
          <div className="job-modal-overlay" role="dialog" aria-modal="true">
            <div className="job-modal">
              <span className="job-modal-icon success" aria-hidden="true">✓</span>
              <h2>Application deleted successfully.</h2>
              <p>The list will refresh automatically.</p>
            </div>
          </div>
        )}


        {/* =========================================
            HEADER
        ========================================= */}

        <div className="job-header">

          <div className="job-header-left">

            <div className="job-title-row">

              <button
                type="button"
                className="back-circle"
                onClick={() => navigate("/app/job-list")}
                title="Back to Job List"
              >
                ←
              </button>

              <h1 className="job-title">
                {job.title}
              </h1>

            </div>


            <div className="job-meta">

              <div className="meta-item">

                <span className="meta-icon">
                  ▣
                </span>

                <span>
                  Department:{" "}
                  <span className="meta-value">
                    {job.department}
                  </span>
                </span>

              </div>


              <div className="meta-item">

                <span className="meta-icon">
                  □
                </span>

                <span>
                  Posted on:{" "}
                  <span className="meta-value">
                    {job.postedDate}
                  </span>
                </span>

              </div>


              <div className="meta-item published-status">

                <span className="published-dot">
                  ✓
                </span>

                {job.status}

              </div>

            </div>

          </div>


          {/* TOP BUTTONS */}

          <div className="header-actions">

            <button
              type="button"
              className="header-btn active"
            >
              Applications
            </button>

          </div>

        </div>


        {/* =========================================
            APPLICATION PIPELINE
        ========================================= */}

        <div className="pipeline">

          {stages.map((stage, index) => (

            <div
              className="pipeline-item-wrapper"
              key={stage.id}
            >

              <button
                type="button"
                className={`pipeline-btn ${
                  activeStage === stage.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActiveStage(stage.id)
                }
              >

                <span
                  className={`stage-icon stage-${stage.id}`}
                >
                  {stage.icon}
                </span>

                <span>
                  {stage.label} ({stage.count})
                </span>

              </button>


              {index < stages.length - 1 &&
                stage.id !== "hired" &&
                stage.id !== "rejected" && (

                  <span className="stage-arrow">
                    ›
                  </span>

                )}

            </div>

          ))}

        </div>


        {/* =========================================
            SEARCH + DATE FILTER
        ========================================= */}

        <div className="filter-card">

          <div className="search-wrapper">

            <span className="search-icon">
              ⌕
            </span>

            <input
              type="text"
              className="search-input"
              placeholder="Search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>


          <input
            type="date"
            className="date-input"
          />

        </div>


        {/* =========================================
            APPLICANT TABLE
        ========================================= */}

        <div className="applicant-table-card">

          <div className="table-scroll">

            <table className="applicant-table">

              <thead>

                <tr>

                  <th>
                    Name
                  </th>

                  <th>
                    Quick Preview
                  </th>

                  <th>
                    Experience
                  </th>

                  <th>
                    Expected Salary
                  </th>

                  <th>
                    Application Date
                  </th>

                  <th>Delete</th>

                </tr>

              </thead>


              {filteredApplicants.length > 0 && (

                <tbody>

                  {filteredApplicants.map(
                    (applicant) => (

                      <tr key={applicant.id}>

                        <td className="applicant-name">
                          {applicant.name}
                        </td>

                        <td>

                          <button
                            type="button"
                            className="preview-btn"
                            onClick={() => openApplicantDetail(applicant.id)}
                          >
                            Preview
                          </button>

                        </td>

                        <td>
                          {applicant.experience}
                        </td>

                        <td>
                          {applicant.expectedSalary}
                        </td>

                        <td>
                          {applicant.applicationDate}
                        </td>

                        <td>

                          <button
                            type="button"
                            className="delete-applicant-btn"
                            onClick={() => setDeleteCandidate(applicant)}
                          >
                            Delete
                          </button>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              )}

            </table>

          </div>


          {/* =========================================
              EMPTY STATE
          ========================================= */}

          {filteredApplicants.length === 0 && (

            <div className="empty-state">

              <div className="empty-icon">

                <div className="paper-one" />

                <div className="paper-two">
                  <div className="paper-line" />
                </div>

              </div>

              <h3 className="empty-title">
                No records found
              </h3>

              <p className="empty-description">
                No applications are available in this stage.
              </p>

            </div>

          )}

        </div>

      </div>

    </s-page>
  );
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Not provided";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(status) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
