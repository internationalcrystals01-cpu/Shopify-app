/* eslint-disable react/prop-types */

import { useState } from "react";
import { useSubmit } from "react-router";
import ResumeDownloadButton from "./ResumeDownloadButton";

const statusActions = [
  ["shortlist", "Move to Shortlisted"],
  ["phone", "Move to Phone"],
  ["test", "Move to Test"],
  ["final", "Move to Final"],
  ["hired", "Move to Hired"],
  ["rejected", "Reject"],
];

export default function ApplicationActions({ application }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const submit = useSubmit();
  const submitApplicationAction = (intent, status = "") => {
    if (
      intent === "delete-application" &&
      !window.confirm(`Delete application for ${application.name}?`)
    ) {
      return;
    }

    const data = new FormData();
    data.append("intent", intent);
    data.append("applicationId", application.id);

    if (status) {
      data.append("status", status);
    }

    setIsMenuOpen(false);
    submit(data, { method: "post" });
  };

  return (
    <div className="application-actions" aria-label={`Actions for ${application.name}`}>
      <button type="button" className="application-view-btn">
        View
      </button>

      <ResumeDownloadButton application={application}>
        <span className="pdf-icon" aria-hidden="true">
          PDF
        </span>
      </ResumeDownloadButton>

      <button
        type="button"
        className="application-icon-btn"
        aria-label={`More actions for ${application.name}`}
        title="More actions"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true">...</span>
      </button>

      {isMenuOpen && (
        <div className="application-actions-menu">
          <button type="button">View Details</button>
          <ResumeDownloadButton
            application={application}
            className=""
            onClick={() => setIsMenuOpen(false)}
          />
          {statusActions.map(([status, label]) => (
            <button
              key={status}
              type="button"
              onClick={() => submitApplicationAction("update-status", status)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="danger"
            onClick={() => submitApplicationAction("delete-application")}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
