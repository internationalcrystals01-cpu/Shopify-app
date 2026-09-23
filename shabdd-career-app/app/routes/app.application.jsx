import { ObjectId } from "mongodb";
import { useMemo, useState } from "react";
import { redirect, useFetcher, useLoaderData } from "react-router";
import ApplicationTable from "../components/applications/ApplicationTable";
import ApplicationStatusBadge from "../components/applications/ApplicationStatusBadge";
import ResumeDownloadButton from "../components/applications/ResumeDownloadButton";
import { client, db } from "../mongodb.server";
import { getApplicationsForShop } from "../models/application.server";
import { authenticate } from "../shopify.server";

const avatarTones = ["blue", "green", "red", "purple"];

const statusLabels = {
  unlisted: "New",
  shortlist: "Shortlisted",
  phone: "Phone",
  face: "Face",
  test: "Test",
  final: "Final",
  hired: "Hired",
  rejected: "Rejected",
};

const applicationStatuses = [
  "unlisted",
  "shortlist",
  "phone",
  "face",
  "test",
  "final",
  "hired",
  "rejected",
];

const workflowStatuses = [
  "shortlist",
  "phone",
  "test",
  "final",
  "hired",
  "rejected",
];

const orderedWorkflowStatuses = [
  "shortlist",
  "phone",
  "test",
  "final",
  "hired",
];

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOrderedSequence(value, token) {
  let tokenIndex = 0;

  for (const character of value) {
    if (character === token[tokenIndex]) {
      tokenIndex += 1;
    }

    if (tokenIndex === token.length) {
      return true;
    }
  }

  return false;
}

function matchesSearchToken(values, token, { allowSequence = true } = {}) {
  return values.some((value) => {
    const normalizedValue = normalizeSearchValue(value);
    const words = normalizedValue.split(/\s+/).filter(Boolean);

    return (
      normalizedValue === token ||
      normalizedValue.startsWith(token) ||
      words.some((word) => word.startsWith(token)) ||
      normalizedValue.includes(token) ||
      (allowSequence && words.some((word) => isOrderedSequence(word, token)))
    );
  });
}

function matchesApplicationSearch(application, searchValue) {
  const tokens = normalizeSearchValue(searchValue).split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const nameValues = [application.name, application.initials];
  const otherValues = [
    application.email,
    application.phone,
    application.appliedFor,
    application.experience,
    application.expectedSalary,
    application.availableStart,
  ];

  return tokens.every((token) => {
    const isShortToken = token.length < 3;

    return (
      matchesSearchToken(nameValues, token, { allowSequence: !isShortToken }) ||
      (!isShortToken &&
        matchesSearchToken(otherValues, token, { allowSequence: true }))
    );
  });
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const applications = await getApplicationsForShop(session.shop);

  return {
    initialApplicationId: url.searchParams.get("applicationId") || "",
    applications: applications.map((application, index) =>
      serializeApplication(application, index),
    ),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const applicationId = String(formData.get("applicationId") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();

  if (!ObjectId.isValid(applicationId)) {
    return null;
  }

  if (!["update-status", "delete-application", "save-note"].includes(intent)) {
    return null;
  }

  if (intent === "update-status" && !applicationStatuses.includes(status)) {
    return null;
  }

  const filter = {
    _id: new ObjectId(applicationId),
    shopId: session.shop,
  };

  await client.connect();

  if (intent === "delete-application") {
    await db.collection("applications").deleteOne(filter);
    return redirect("/app/application");
  }

  if (intent === "save-note") {
    if (!note) {
      return null;
    }

    const createdAt = new Date();
    await db.collection("applications").updateOne(filter, {
      $set: {
        updatedAt: createdAt,
      },
      $push: {
        notes: {
          note,
          status: status || "",
          createdAt,
        },
      },
    });

    return null;
  }

  const application = await db.collection("applications").findOne(filter, {
    projection: {
      status: 1,
    },
  });

  if (
    !application ||
    application.status === "rejected" ||
    !canMoveToStatus(application.status, status)
  ) {
    return null;
  }

  const changedAt = new Date();
  const statusHistoryEntry = {
    status,
    changedAt,
    ...(note ? { note } : {}),
  };
  const update = {
    $set: {
      status,
      updatedAt: changedAt,
    },
    $push: {
      statusHistory: statusHistoryEntry,
    },
  };

  if (note) {
    update.$push.notes = {
      note,
      status,
      createdAt: changedAt,
    };
  }

  await db.collection("applications").updateOne(filter, {
    ...update,
  });

  return null;
};

export default function Applications() {
  const { applications, initialApplicationId } = useLoaderData();
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplicationId, setSelectedApplicationId] = useState(
    applications.some((application) => application.id === initialApplicationId)
      ? initialApplicationId
      : "",
  );
  const statusFilterOptions = [
    ["all", "All Status"],
    ["unlisted", "New"],
    ["shortlist", "Shortlisted"],
    ["phone", "Phone"],
    ["test", "Test"],
    ["final", "Final"],
    ["hired", "Hired"],
    ["rejected", "Rejected"],
  ];
  const selectedStatusLabel =
    statusFilterOptions.find(([value]) => value === statusFilter)?.[1] || "All Status";

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const matchesSearch = matchesApplicationSearch(application, search);
      const matchesStatus =
        statusFilter === "all" || application.statusKey === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const selectedApplication = applications.find(
    (application) => application.id === selectedApplicationId,
  );

  if (selectedApplication) {
    return (
      <s-page>
        <ApplicationDetailStyles />
        <ApplicationDetail
          key={selectedApplication.id}
          application={selectedApplication}
          applications={applications}
          onBack={() => setSelectedApplicationId("")}
          onSelect={(applicationId) => setSelectedApplicationId(applicationId)}
        />
      </s-page>
    );
  }

  return (
    <s-page>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .applications-page {
          width: calc(100vw - 96px);
          min-height: 100vh;
          padding: 18px 20px;
          background: #f6f8fb;
          color: #071436;
          font-family: Inter, sans-serif;
          margin-left: calc(50% - 50vw + 48px);
          margin-right: 48px;
        }

        .applications-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .applications-title {
          margin: 0;
          color: #071436;
          font-size: 28px;
          line-height: 34px;
          font-weight: 750;
        }

        .applications-subtitle {
          margin: 4px 0 0;
          color: #303a5f;
          font-size: 14px;
          line-height: 20px;
        }

        .applications-export-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          height: 42px;
          min-width: 118px;
          padding: 0 18px;
          border: 1px solid #d7deec;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          cursor: pointer;
          font-size: 14px;
          font-weight: 750;
        }

        .applications-export-icon {
          font-size: 12px;
          line-height: 1;
        }

        .applications-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 12px;
          margin-bottom: 10px;
          background: #ffffff;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
        }

        .applications-toolbar-left,
        .applications-toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .applications-search-wrap {
          position: relative;
          width: 320px;
        }

        .applications-search-icon {
          position: absolute;
          top: 50%;
          left: 13px;
          width: 14px;
          height: 14px;
          border: 2px solid #071436;
          border-radius: 50%;
          color: #071436;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .applications-search-icon::after {
          content: "";
          position: absolute;
          right: -5px;
          bottom: -4px;
          width: 7px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transform: rotate(45deg);
        }

        .applications-search {
          width: 100%;
          height: 38px;
          padding: 0 12px 0 35px;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          outline: none;
          font-size: 12px;
        }

        .applications-search:focus {
          border-color: #2457d6;
          box-shadow: 0 0 0 2px rgba(36, 87, 214, 0.1);
        }

        .applications-filter-btn,
        .applications-status-select,
        .applications-date-input {
          height: 38px;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          font-size: 12px;
        }

        .applications-filter-btn {
          position: relative;
          padding: 0 14px 0 34px;
          cursor: pointer;
        }

        .applications-filter-wrap {
          position: relative;
        }

        .applications-filter-btn::before {
          content: "";
          position: absolute;
          top: 11px;
          left: 14px;
          width: 10px;
          height: 10px;
          border: 2px solid currentColor;
          border-top: 0;
          border-left: 0;
          transform: rotate(45deg);
        }

        .applications-filter-count {
          position: absolute;
          top: -10px;
          right: -10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2457d6;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
        }

        .applications-filter-count.empty {
          display: none;
        }

        .applications-filter-menu {
          position: absolute;
          top: 46px;
          left: 0;
          z-index: 30;
          width: 210px;
          padding: 8px;
          border: 1px solid #dce3ef;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
        }

        .applications-filter-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-height: 36px;
          padding: 0 10px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #071436;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
        }

        .applications-filter-option:hover,
        .applications-filter-option.active {
          background: #eef5ff;
          color: #145de0;
        }

        .applications-filter-option span {
          color: #52607d;
          font-size: 11px;
          font-weight: 800;
        }

        .applications-status-select {
          width: 148px;
          padding: 0 10px;
        }

        .applications-date-input {
          width: 270px;
          padding: 0 10px;
        }

        .applications-table-card {
          width: 100%;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e7ecf4;
          border-radius: 9px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.04);
        }

        .applications-table-scroll {
          overflow-x: auto;
        }

        .applications-table {
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
        }

        .applications-table thead {
          background: #c9efff;
        }

        .applications-table th {
          padding: 13px 16px;
          color: #071436;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .applications-table td {
          padding: 15px 16px;
          border-bottom: 1px solid #e8edf5;
          color: #071436;
          font-size: 12px;
          vertical-align: middle;
          white-space: nowrap;
        }

        .applications-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .application-table-row {
          cursor: pointer;
        }

        .application-table-row:hover td {
          background: #f8fbff;
        }

        .application-person {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .application-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-size: 15px;
          font-weight: 700;
        }

        .application-avatar.blue {
          background: #e3efff;
          color: #2457d6;
        }

        .application-avatar.green {
          background: #dff7eb;
          color: #06905f;
        }

        .application-avatar.red {
          background: #ffe6eb;
          color: #e11d48;
        }

        .application-avatar.purple {
          background: #eee3ff;
          color: #7c3aed;
        }

        .application-name {
          display: block;
          margin-bottom: 3px;
          font-size: 14px;
          font-weight: 700;
        }

        .application-contact {
          display: block;
          margin-top: 2px;
          color: #34405f;
          font-size: 12px;
        }

        .application-status {
          display: inline-flex;
          align-items: center;
          min-width: 72px;
          justify-content: center;
          padding: 6px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .application-status::before {
          content: "";
          width: 7px;
          height: 7px;
          margin-right: 7px;
          border-radius: 50%;
          background: currentColor;
        }

        .application-status.new {
          background: #e2efff;
          color: #145de0;
        }

        .application-status.shortlist {
          background: #eee3ff;
          color: #6d28d9;
        }

        .application-status.interview {
          background: #fff0cf;
          color: #db7c00;
        }

        .application-status.phone {
          background: #e0f2fe;
          color: #0369a1;
        }

        .application-status.face {
          background: #ede9fe;
          color: #6d28d9;
        }

        .application-status.test {
          background: #cffafe;
          color: #0e7490;
        }

        .application-status.final {
          background: #dcf5eb;
          color: #079568;
        }

        .application-status.hired {
          background: #dcfce7;
          color: #15803d;
        }

        .application-status.rejected {
          background: #ffe3e6;
          color: #e11d2f;
        }

        .application-status.default {
          background: #eef2f7;
          color: #475569;
        }

        .application-actions {
          position: relative;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .application-view-btn,
        .application-icon-btn {
          height: 35px;
          border: 1px solid #cfd7e7;
          border-radius: 6px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
        }

        .application-view-btn {
          padding: 0 14px;
          font-size: 11px;
          font-weight: 700;
        }

        .application-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          padding: 0;
          font-size: 11px;
          font-weight: 750;
          text-decoration: none;
        }

        .application-view-btn:hover,
        .application-icon-btn:hover {
          background: #f4f7fb;
        }

        .application-icon-btn.pdf {
          border-color: #d8e0f2;
          color: #e11d2f;
        }

        .application-icon-btn.pdf.disabled {
          color: #9aa3b5;
          cursor: not-allowed;
          opacity: 0.55;
        }

        .application-icon-btn.pdf.disabled .pdf-icon {
          background: #9aa3b5;
        }

        .pdf-icon {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 22px;
          border-radius: 2px;
          background: #ef4444;
          color: #ffffff;
          font-size: 7px;
          font-weight: 850;
          line-height: 1;
        }

        .pdf-icon::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 0;
          height: 0;
          border-top: 6px solid #ffffff;
          border-left: 6px solid rgba(255, 255, 255, 0.5);
        }

        .pdf-icon.big {
          width: 38px;
          height: 44px;
          font-size: 11px;
        }

        .pdf-icon.big::after {
          border-top-width: 10px;
          border-left-width: 10px;
        }

        .application-detail-page {
          background: linear-gradient(180deg, #f7fbff 0%, #eef7ff 100%);
        }

        .application-back-link {
          margin: 4px 0 22px;
          border: 0;
          background: transparent;
          color: #145de0;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
        }

        .application-detail-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .application-profile {
          display: flex;
          gap: 18px;
          align-items: flex-start;
        }

        .application-avatar.detail {
          width: 72px;
          height: 72px;
          font-size: 22px;
        }

        .application-profile-meta {
          margin: 7px 0 14px;
          color: #34405f;
          font-size: 15px;
        }

        .application-profile-meta span {
          margin: 0 8px;
        }

        .application-contact-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .application-contact-pills span,
        .application-contact-pills a {
          display: inline-flex;
          min-height: 32px;
          align-items: center;
          padding: 0 12px;
          border: 1px solid #d7e1ef;
          border-radius: 999px;
          background: #ffffff;
          color: #34405f;
          font-size: 13px;
          text-decoration: none;
        }

        .application-detail-nav {
          display: flex;
          flex-shrink: 0;
          gap: 10px;
        }

        .application-detail-nav button,
        .application-status-editor button,
        .application-resume-actions a,
        .application-resume-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          min-width: 112px;
          padding: 0 18px;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .application-detail-nav button:disabled,
        .application-resume-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .application-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 18px;
          align-items: start;
        }

        .application-detail-main,
        .application-detail-side {
          display: grid;
          gap: 18px;
        }

        .application-detail-card {
          border: 1px solid #dfe7f2;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.05);
          padding: 22px;
        }

        .application-status-card {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
          gap: 24px;
        }

        .application-section-title {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .application-section-title.compact {
          align-items: center;
          margin-bottom: 18px;
        }

        .application-section-title h2 {
          margin: 0 0 12px;
          color: #071436;
          font-size: 21px;
          font-weight: 850;
        }

        .application-section-title.compact h2 {
          margin: 0;
          font-size: 20px;
        }

        .application-section-title p {
          margin: 16px 0 0;
          color: #52607d;
          font-size: 13px;
          line-height: 20px;
        }

        .application-section-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 9px;
          background: #eaf2ff;
          color: #1769ff;
          font-size: 12px;
          font-weight: 850;
        }

        .application-status-editor {
          display: grid;
          gap: 12px;
        }

        .application-status-editor label {
          display: grid;
          gap: 7px;
          color: #071436;
          font-size: 13px;
          font-weight: 800;
        }

        .application-status-editor select,
        .application-status-editor textarea {
          width: 100%;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        .application-status-editor select {
          height: 40px;
          padding: 0 12px;
        }

        .application-status-editor textarea {
          min-height: 78px;
          padding: 12px;
          resize: vertical;
        }

        .application-status-editor button,
        .application-resume-actions a:last-child,
        .application-resume-actions .application-resume-download {
          justify-self: end;
          border-color: #145de0;
          background: #145de0;
          color: #ffffff;
        }

        .application-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px 34px;
        }

        .application-info-grid div,
        .application-skill-row {
          display: grid;
          gap: 8px;
        }

        .application-info-grid strong,
        .application-skill-row strong {
          color: #071436;
          font-size: 13px;
          font-weight: 850;
        }

        .application-info-grid span,
        .application-skill-row em {
          color: #243154;
          font-size: 15px;
          font-style: normal;
          line-height: 21px;
          overflow-wrap: anywhere;
        }

        .application-skill-row {
          margin-top: 22px;
        }

        .application-skill-row div {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .application-skill-row span {
          padding: 7px 13px;
          border-radius: 999px;
          background: #edf3ff;
          color: #34405f;
          font-size: 13px;
        }

        .application-resume-box {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border: 1px solid #d7e1ef;
          border-radius: 8px;
        }

        .application-resume-box strong,
        .application-resume-box span {
          display: block;
        }

        .application-resume-box strong {
          color: #071436;
          font-size: 14px;
          word-break: break-word;
        }

        .application-resume-box span {
          margin-top: 5px;
          color: #34405f;
          font-size: 13px;
        }

        .application-resume-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        .application-quick-actions {
          display: grid;
          gap: 8px;
        }

        .application-quick-actions button {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid #d7e1ef;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          text-align: left;
        }

        .application-quick-actions span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          font-weight: 850;
        }

        .application-quick-actions .green { background: #dcfce7; color: #15803d; }
        .application-quick-actions .blue { background: #dbeafe; color: #145de0; }
        .application-quick-actions .purple { background: #ede9fe; color: #6d28d9; }
        .application-quick-actions .orange { background: #ffedd5; color: #ea580c; }
        .application-quick-actions .gold { background: #fef3c7; color: #b45309; }
        .application-quick-actions .red { background: #ffe3e6; color: #e11d2f; }

        .application-timeline {
          display: grid;
          gap: 18px;
        }

        .application-timeline div {
          position: relative;
          padding-left: 22px;
        }

        .application-timeline div::before {
          content: "";
          position: absolute;
          top: 3px;
          left: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #145de0;
          box-shadow: 0 0 0 4px #eaf2ff;
        }

        .application-timeline strong,
        .application-timeline span {
          display: block;
          color: #071436;
          font-size: 13px;
          font-weight: 850;
        }

        .application-timeline span,
        .application-timeline p,
        .application-empty-note {
          color: #52607d;
          font-size: 13px;
        }

        .application-timeline p {
          margin: 4px 0 0;
        }

        .application-empty-note {
          margin: 0;
        }

        .application-actions-menu {
          position: absolute;
          top: 42px;
          right: 0;
          z-index: 20;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          width: 560px;
          max-width: calc(100vw - 64px);
          padding: 8px;
          border: 1px solid #dce3ef;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        }

        .application-actions-menu button,
        .application-actions-menu a {
          display: inline-flex;
          align-items: center;
          width: auto;
          height: 34px;
          padding: 0 12px;
          border: 1px solid #dce3ef;
          border-radius: 6px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          text-decoration: none;
          white-space: nowrap;
        }

        .application-actions-menu button:hover,
        .application-actions-menu a:hover {
          background: #f4f7fb;
        }

        .application-actions-menu .danger {
          border-color: #fecdd3;
          background: #fff1f2;
          color: #e11d2f;
        }

        .applications-empty-row td {
          height: 260px;
          color: #687083;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
        }

        .applications-table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 58px;
          padding: 12px 16px;
          border-top: 1px solid #e8edf5;
          color: #34405f;
          font-size: 14px;
        }

        .applications-pagination {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .application-page-btn {
          width: 38px;
          height: 38px;
          border: 1px solid #cfd7e7;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
        }

        .application-page-btn.active {
          border-color: #2457d6;
          background: #2457d6;
          color: #ffffff;
        }

        @media (max-width: 820px) {
          .applications-page {
            width: 100%;
            margin: 0;
            padding: 14px;
          }

          .applications-header {
            flex-direction: column;
          }

          .applications-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .applications-toolbar-left,
          .applications-toolbar-right {
            width: 100%;
            flex-wrap: wrap;
          }

          .applications-search-wrap,
          .applications-status-select,
          .applications-date-input {
            width: 100%;
            flex: 1 1 220px;
          }

          .applications-table-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .application-detail-top,
          .application-profile {
            flex-direction: column;
          }

          .application-detail-nav {
            width: 100%;
          }

          .application-detail-nav button {
            flex: 1;
          }

          .application-detail-grid,
          .application-status-card,
          .application-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="applications-page">
        <div className="applications-header">
          <div>
            <h1 className="applications-title">All Applications</h1>
            <p className="applications-subtitle">
              Manage and track all job applications in one place.
            </p>
          </div>

          <button type="button" className="applications-export-btn">
            <span className="applications-export-icon" aria-hidden="true">
              DL
            </span>
            Export
          </button>
        </div>

        <div className="applications-toolbar">
          <div className="applications-toolbar-left">
            <label className="applications-search-wrap" aria-label="Search applications">
              <span className="applications-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="applications-search"
                placeholder="Search by name, email, job title..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="applications-filter-wrap">
              <button
                type="button"
                className="applications-filter-btn"
                onClick={() => setIsFilterOpen((current) => !current)}
              >
                {selectedStatusLabel}
                <span
                  className="applications-filter-count"
                >
                  {filteredApplications.length}
                </span>
              </button>

              {isFilterOpen && (
                <div className="applications-filter-menu">
                  {statusFilterOptions.map(([value, label]) => {
                    const countForStatus =
                      value === "all"
                        ? applications.length
                        : applications.filter(
                            (application) => application.statusKey === value,
                          ).length;

                    return (
                      <button
                        key={value}
                        type="button"
                        className={`applications-filter-option${
                          statusFilter === value ? " active" : ""
                        }`}
                        onClick={() => {
                          setStatusFilter(value);
                          setIsFilterOpen(false);
                        }}
                      >
                        {label}
                        <span>{countForStatus}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="applications-toolbar-right">
            <input
              type="text"
              className="applications-date-input"
              placeholder="Select date range"
              readOnly
            />
          </div>
        </div>

        <ApplicationTable
          applications={filteredApplications}
          totalApplications={applications.length}
          onSelectApplication={(application) => setSelectedApplicationId(application.id)}
        />
      </div>
    </s-page>
  );
}

function ApplicationDetailStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }

      .applications-page {
        width: calc(100vw - 96px);
        min-height: 100vh;
        margin-left: calc(50% - 50vw + 48px);
        margin-right: 48px;
        padding: 24px 34px;
        color: #071436;
        font-family: Inter, sans-serif;
      }

      .application-detail-page {
        background: linear-gradient(180deg, #f7fbff 0%, #eef7ff 100%);
      }

      .applications-title {
        margin: 0;
        color: #071436;
        font-size: 30px;
        line-height: 36px;
        font-weight: 800;
      }

      .application-back-link {
        margin: 4px 0 22px;
        border: 0;
        background: transparent;
        color: #145de0;
        cursor: pointer;
        font-size: 14px;
        font-weight: 800;
      }

      .application-detail-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 22px;
      }

      .application-profile {
        display: flex;
        gap: 18px;
        align-items: flex-start;
      }

      .application-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 50%;
        font-weight: 800;
      }

      .application-avatar.detail {
        width: 72px;
        height: 72px;
        font-size: 22px;
      }

      .application-avatar.blue { background: #e3efff; color: #2457d6; }
      .application-avatar.green { background: #dff7eb; color: #06905f; }
      .application-avatar.red { background: #ffe6eb; color: #e11d48; }
      .application-avatar.purple { background: #eee3ff; color: #7c3aed; }

      .application-profile-meta {
        margin: 7px 0 14px;
        color: #34405f;
        font-size: 15px;
      }

      .application-profile-meta span {
        margin: 0 8px;
      }

      .application-contact-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .application-contact-pills span,
      .application-contact-pills a {
        display: inline-flex;
        min-height: 32px;
        align-items: center;
        padding: 0 12px;
        border: 1px solid #d7e1ef;
        border-radius: 999px;
        background: #ffffff;
        color: #34405f;
        font-size: 13px;
        text-decoration: none;
      }

      .application-detail-nav {
        display: flex;
        flex-shrink: 0;
        gap: 10px;
      }

      .application-detail-nav button,
      .application-resume-actions a,
      .application-resume-actions button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 40px;
        min-width: 112px;
        padding: 0 18px;
        border: 1px solid #cfd7e7;
        border-radius: 7px;
        background: #ffffff;
        color: #071436;
        cursor: pointer;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none;
        white-space: nowrap;
      }

      .application-detail-nav button:disabled,
      .application-resume-actions button:disabled,
      .application-quick-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .application-detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 18px;
        align-items: start;
      }

      .application-detail-main,
      .application-detail-side {
        display: grid;
        gap: 18px;
      }

      .application-detail-card {
        border: 1px solid #dfe7f2;
        border-radius: 10px;
        background: #ffffff;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.05);
        padding: 22px;
      }

      .application-status-card {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
        gap: 24px;
      }

      .application-section-title {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }

      .application-section-title.compact {
        align-items: center;
        margin-bottom: 18px;
      }

      .application-section-title h2 {
        margin: 0 0 12px;
        color: #071436;
        font-size: 21px;
        font-weight: 850;
      }

      .application-section-title.compact h2 {
        margin: 0;
        font-size: 20px;
      }

      .application-section-title p {
        margin: 16px 0 0;
        color: #52607d;
        font-size: 13px;
        line-height: 20px;
      }

      .application-section-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 42px;
        height: 42px;
        border-radius: 9px;
        background: #eaf2ff;
        color: #1769ff;
        font-size: 12px;
        font-weight: 850;
      }

      .application-status {
        display: inline-flex;
        align-items: center;
        min-width: 72px;
        justify-content: center;
        padding: 6px 11px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
      }

      .application-status::before {
        content: "";
        width: 7px;
        height: 7px;
        margin-right: 7px;
        border-radius: 50%;
        background: currentColor;
      }

      .application-status.new { background: #e2efff; color: #145de0; }
      .application-status.shortlist { background: #eee3ff; color: #6d28d9; }
      .application-status.phone { background: #e0f2fe; color: #0369a1; }
      .application-status.face { background: #ede9fe; color: #6d28d9; }
      .application-status.test { background: #cffafe; color: #0e7490; }
      .application-status.final { background: #dcf5eb; color: #079568; }
      .application-status.hired { background: #dcfce7; color: #15803d; }
      .application-status.rejected { background: #ffe3e6; color: #e11d2f; }
      .application-status.default { background: #eef2f7; color: #475569; }

      .application-note-field {
        display: grid;
        gap: 7px;
        margin-top: 18px;
        color: #071436;
        font-size: 13px;
        font-weight: 800;
      }

      .application-note-field textarea {
        width: 100%;
        border: 1px solid #cfd7e7;
        border-radius: 7px;
        background: #ffffff;
        color: #071436;
        font: inherit;
        font-size: 13px;
        outline: none;
      }

      .application-note-field textarea {
        min-height: 78px;
        padding: 12px;
        resize: vertical;
      }

      .application-note-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }

      .application-note-actions button {
        height: 36px;
        padding: 0 14px;
        border: 1px solid #145de0;
        border-radius: 7px;
        background: #145de0;
        color: #ffffff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 800;
      }

      .application-note-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .application-saved-notes {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .application-saved-notes h3 {
        margin: 0;
        color: #071436;
        font-size: 13px;
        font-weight: 850;
      }

      .application-saved-notes div {
        padding: 9px 11px;
        border: 1px solid #dbe5f2;
        border-radius: 7px;
        background: #f8fbff;
      }

      .application-saved-notes p,
      .application-saved-notes span {
        margin: 0;
        color: #52607d;
        font-size: 12px;
        line-height: 18px;
      }

      .application-saved-notes p {
        color: #243154;
        font-size: 13px;
      }

      .application-resume-actions a:last-child,
      .application-resume-actions .application-resume-download {
        justify-self: end;
        border-color: #145de0;
        background: #145de0;
        color: #ffffff;
      }

      .application-info-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 22px 34px;
      }

      .application-info-grid div,
      .application-skill-row {
        display: grid;
        gap: 8px;
      }

      .application-info-grid strong,
      .application-skill-row strong {
        color: #071436;
        font-size: 13px;
        font-weight: 850;
      }

      .application-info-grid span,
      .application-skill-row em {
        color: #243154;
        font-size: 15px;
        font-style: normal;
        line-height: 21px;
        overflow-wrap: anywhere;
      }

      .application-skill-row {
        margin-top: 22px;
      }

      .application-skill-row div {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
      }

      .application-skill-row span {
        padding: 7px 13px;
        border-radius: 999px;
        background: #edf3ff;
        color: #34405f;
        font-size: 13px;
      }

      .pdf-icon {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 22px;
        border-radius: 2px;
        background: #ef4444;
        color: #ffffff;
        font-size: 7px;
        font-weight: 850;
        line-height: 1;
      }

      .pdf-icon::after {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        width: 0;
        height: 0;
        border-top: 6px solid #ffffff;
        border-left: 6px solid rgba(255, 255, 255, 0.5);
      }

      .pdf-icon.big {
        width: 38px;
        height: 44px;
        font-size: 11px;
      }

      .pdf-icon.big::after {
        border-top-width: 10px;
        border-left-width: 10px;
      }

      .application-resume-box {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        border: 1px solid #d7e1ef;
        border-radius: 8px;
      }

      .application-resume-box strong,
      .application-resume-box span {
        display: block;
      }

      .application-resume-box strong {
        color: #071436;
        font-size: 14px;
        word-break: break-word;
      }

      .application-resume-box span {
        margin-top: 5px;
        color: #34405f;
        font-size: 13px;
      }

      .application-resume-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }

      .application-quick-actions {
        display: grid;
        gap: 8px;
      }

      .application-quick-actions button {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 42px;
        padding: 0 12px;
        border: 1px solid #d7e1ef;
        border-radius: 7px;
        background: #ffffff;
        color: #071436;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        text-align: left;
      }

      .application-quick-actions span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        font-weight: 850;
      }

      .application-quick-actions .green { background: #dcfce7; color: #15803d; }
      .application-quick-actions .blue { background: #dbeafe; color: #145de0; }
      .application-quick-actions .purple { background: #ede9fe; color: #6d28d9; }
      .application-quick-actions .orange { background: #ffedd5; color: #ea580c; }
      .application-quick-actions .gold { background: #fef3c7; color: #b45309; }
      .application-quick-actions .red { background: #ffe3e6; color: #e11d2f; }

      .application-timeline {
        position: relative;
        display: grid;
        gap: 20px;
      }

      .application-timeline div {
        position: relative;
        padding-left: 28px;
      }

      .application-timeline div::before {
        content: "";
        position: absolute;
        top: 3px;
        left: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #145de0;
        box-shadow: 0 0 0 4px #eaf2ff;
      }

      .application-timeline div::after {
        content: "";
        position: absolute;
        top: 18px;
        bottom: -20px;
        left: 4px;
        width: 2px;
        background: #d8e4f5;
      }

      .application-timeline div:last-child::after {
        display: none;
      }

      .application-timeline .timeline-shortlist::before,
      .application-timeline .timeline-hired::before {
        background: #22c55e;
        box-shadow: 0 0 0 4px #dcfce7;
      }

      .application-timeline .timeline-phone::before {
        background: #2563eb;
        box-shadow: 0 0 0 4px #dbeafe;
      }

      .application-timeline .timeline-test::before {
        background: #f97316;
        box-shadow: 0 0 0 4px #ffedd5;
      }

      .application-timeline .timeline-final::before {
        background: #f59e0b;
        box-shadow: 0 0 0 4px #fef3c7;
      }

      .application-timeline .timeline-rejected::before {
        background: #ef4444;
        box-shadow: 0 0 0 4px #fee2e2;
      }

      .application-timeline .timeline-rejected.blink::before {
        animation: rejectedPulse 1s ease-in-out infinite;
      }

      @keyframes rejectedPulse {
        0%, 100% {
          box-shadow: 0 0 0 4px #fee2e2;
          opacity: 1;
        }
        50% {
          box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.18);
          opacity: 0.55;
        }
      }

      .application-timeline strong,
      .application-timeline span {
        display: block;
        color: #071436;
        font-size: 13px;
        font-weight: 850;
      }

      .application-timeline span,
      .application-timeline p {
        color: #52607d;
        font-size: 13px;
      }

      .application-timeline p {
        margin: 4px 0 0;
      }

      .application-timeline .timeline-note {
        margin-top: 8px;
        padding: 9px 11px;
        border-left: 3px solid #145de0;
        border-radius: 6px;
        background: #f3f7ff;
        color: #243154;
      }

      .application-status-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(7, 20, 54, 0.42);
      }

      .application-status-modal {
        width: min(430px, 100%);
        border: 1px solid #dbe5f2;
        border-radius: 10px;
        background: #ffffff;
        box-shadow: 0 28px 70px rgba(15, 23, 42, 0.28);
        padding: 22px;
      }

      .application-status-modal h3 {
        margin: 0;
        color: #071436;
        font-size: 20px;
        font-weight: 850;
      }

      .application-status-modal p {
        margin: 10px 0 0;
        color: #52607d;
        font-size: 14px;
        line-height: 21px;
      }

      .application-status-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 22px;
      }

      .application-status-modal-actions button {
        height: 38px;
        padding: 0 16px;
        border: 1px solid #cfd7e7;
        border-radius: 7px;
        background: #ffffff;
        color: #071436;
        cursor: pointer;
        font-size: 13px;
        font-weight: 800;
      }

      .application-status-modal-actions .primary {
        border-color: #145de0;
        background: #145de0;
        color: #ffffff;
      }

      @media (max-width: 820px) {
        .applications-page {
          width: 100%;
          margin: 0;
          padding: 14px;
        }

        .application-detail-top,
        .application-profile {
          flex-direction: column;
        }

        .application-detail-nav {
          width: 100%;
        }

        .application-detail-nav button {
          flex: 1;
        }

        .application-detail-grid,
        .application-status-card,
        .application-info-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}

function ApplicationDetail({ application, applications, onBack, onSelect }) {
  const fetcher = useFetcher();
  const [statusNote, setStatusNote] = useState("");
  const [statusDialog, setStatusDialog] = useState(null);
  const currentIndex = applications.findIndex((item) => item.id === application.id);
  const previousApplication = applications[currentIndex - 1];
  const nextApplication = applications[currentIndex + 1];
  const quickActions = [
    ["shortlist", "Move to Shortlisted", "green"],
    ["phone", "Move to Phone", "blue"],
    ["test", "Move to Test", "orange"],
    ["final", "Move to Final", "gold"],
    ["hired", "Move to Hired", "green"],
    ["rejected", "Reject", "red"],
  ];

  const requestStatusChange = (status) => {
    if (!status || status === application.statusKey) {
      return;
    }

    if (application.statusKey === "rejected") {
      setStatusDialog({
        type: "info",
        title: "Timeline closed",
        message: "This application is rejected. You cannot update its status now.",
      });
      return;
    }

    const statusLabel = statusLabels[status] || status;

    if (!canMoveToStatus(application.statusKey, status)) {
      setStatusDialog({
        type: "info",
        title: "Complete previous step first",
        message:
          status === "rejected"
            ? "You can reject this application from the current step."
            : `You cannot move directly to ${statusLabel}. Please complete the process step by step.`,
      });
      return;
    }

    setStatusDialog({
      type: "confirm",
      status,
      title: "Update status?",
      message: `Do you want to update the status to ${statusLabel}?`,
    });
  };

  const confirmStatusChange = () => {
    if (!statusDialog?.status) {
      setStatusDialog(null);
      return;
    }

    const data = new FormData();
    data.append("intent", "update-status");
    data.append("applicationId", application.id);
    data.append("status", statusDialog.status);
    data.append("note", statusNote.trim());
    setStatusNote("");
    setStatusDialog(null);
    fetcher.submit(data, { method: "post" });
  };

  const requestSaveNote = () => {
    const note = statusNote.trim();

    if (!note) {
      setStatusDialog({
        type: "info",
        title: "Add a note",
        message: "Please write a note before saving.",
      });
      return;
    }

    setStatusDialog({
      type: "save-note",
      title: "Save note?",
      message: "Do you want to save this note?",
    });
  };

  const confirmSaveNote = () => {
    const note = statusNote.trim();

    if (!note) {
      setStatusDialog(null);
      return;
    }

    const data = new FormData();
    data.append("intent", "save-note");
    data.append("applicationId", application.id);
    data.append("status", application.statusKey);
    data.append("note", note);
    setStatusNote("");
    setStatusDialog({
      type: "info",
      title: "Note saved",
      message: "Your note has been saved.",
    });
    fetcher.submit(data, { method: "post" });
  };

  return (
    <div className="applications-page application-detail-page">
      <button type="button" className="application-back-link" onClick={onBack}>
        &lt; Back to Applications
      </button>

      <div className="application-detail-top">
        <div className="application-profile">
          <span className={`application-avatar detail ${application.avatarTone}`}>
            {application.initials}
          </span>
          <div>
            <h1 className="applications-title">{application.name}</h1>
            <p className="application-profile-meta">
              {application.appliedFor} <span>-</span> Applied on {application.appliedOn}
            </p>
            <div className="application-contact-pills">
              <span>{application.email}</span>
              <span>{application.phone}</span>
              <span>{application.currentCity}</span>
              {application.linkedin && application.linkedin !== "Not provided" && (
                <a href={application.linkedin} target="_blank" rel="noreferrer">
                  {application.linkedin}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="application-detail-nav">
          <button
            type="button"
            disabled={!previousApplication}
            onClick={() => previousApplication && onSelect(previousApplication.id)}
          >
            &lt; Previous
          </button>
          <button
            type="button"
            disabled={!nextApplication}
            onClick={() => nextApplication && onSelect(nextApplication.id)}
          >
            Next &gt;
          </button>
        </div>
      </div>

      <div className="application-detail-grid">
        <main className="application-detail-main">
          <section className="application-detail-card application-status-card">
            <div className="application-section-title">
              <span className="application-section-icon">ST</span>
              <div>
                <h2>Application Status</h2>
                <ApplicationStatusBadge status={application.status} />
                <p>Update the application status and add notes.</p>
                <label className="application-note-field">
                  Add a note (optional)
                  <textarea
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder="Write a note about this status update..."
                  />
                </label>
                <div className="application-note-actions">
                  <button
                    type="button"
                    disabled={!statusNote.trim()}
                    onClick={requestSaveNote}
                  >
                    Save Note
                  </button>
                </div>
                {application.savedNotes.length > 0 && (
                  <div className="application-saved-notes">
                    <h3>Saved Notes</h3>
                    {application.savedNotes.map((note) => (
                      <div key={`${note.createdAt}-${note.note}`}>
                        <p>{note.note}</p>
                        <span>{note.createdAt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="application-status-resume">
              <div className="application-section-title compact">
                <span className="application-section-icon">PDF</span>
                <h2>Resume</h2>
              </div>
              <div className="application-resume-box">
                <span className="pdf-icon big" aria-hidden="true">PDF</span>
                <div>
                  <strong>{application.resumeFileName}</strong>
                  <span>{application.resumeFileSize}</span>
                </div>
              </div>
              <div className="application-resume-actions">
                {application.hasResume ? (
                  <>
                    <a href={application.resumeViewUrl} target="_blank" rel="noreferrer">
                      View Resume
                    </a>
                    <ResumeDownloadButton
                      application={application}
                      className="application-resume-download"
                    >
                      Download
                    </ResumeDownloadButton>
                  </>
                ) : (
                  <button type="button" disabled>No Resume Available</button>
                )}
              </div>
            </div>
          </section>

          <InfoCard title="Personal Information" icon="PI">
            <InfoGrid
              items={[
                ["Full Name", application.name],
                ["Email Address", application.email],
                ["Phone Number", application.phone],
                ["Current City / Location", application.currentCity],
                ["LinkedIn Profile", application.linkedin],
              ]}
            />
          </InfoCard>

          <InfoCard title="Professional Information" icon="PRO">
            <InfoGrid
              items={[
                ["Work Experience", application.experience],
                ["Highest Qualification", application.qualification],
                ["Available Start Date", application.availableStart],
                ["Expected Salary", application.expectedSalary],
                ["Salary Period", application.salaryType],
              ]}
            />
            <div className="application-skill-row">
              <strong>Skills</strong>
              <div>
                {application.skills.length > 0 ? (
                  application.skills.map((skill) => <span key={skill}>{skill}</span>)
                ) : (
                  <em>Not provided</em>
                )}
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Application Details" icon="APP">
            <InfoGrid items={[["Applied For", application.appliedFor]]} />
          </InfoCard>
        </main>

        <aside className="application-detail-side">
          <section className="application-detail-card">
            <div className="application-section-title compact">
              <span className="application-section-icon">QA</span>
              <h2>Quick Actions</h2>
            </div>
            <div className="application-quick-actions">
              {quickActions.map(([status, label, tone]) => (
                <button
                  key={status}
                  type="button"
                  disabled={
                    application.statusKey === "rejected" ||
                    !canMoveToStatus(application.statusKey, status)
                  }
                  onClick={() => requestStatusChange(status)}
                >
                  <span className={tone}>{statusLabels[status][0]}</span>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="application-detail-card">
            <div className="application-section-title compact">
              <span className="application-section-icon">TM</span>
              <h2>Timeline</h2>
            </div>
            <div className="application-timeline">
              {application.timeline.map((item) => (
                <div
                  key={`${item.status}-${item.changedAt}`}
                  className={`timeline-${item.status}${item.blink ? " blink" : ""}`}
                >
                  <strong>{item.label}</strong>
                  <span>{item.changedAt}</span>
                  <p>{item.description}</p>
                  {item.note && <p className="timeline-note">{item.note}</p>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {statusDialog && (
        <div className="application-status-modal-backdrop" role="dialog" aria-modal="true">
          <div className="application-status-modal">
            <h3>{statusDialog.title}</h3>
            <p>{statusDialog.message}</p>
            <div className="application-status-modal-actions">
              {statusDialog.type === "confirm" ? (
                <>
                  <button type="button" onClick={() => setStatusDialog(null)}>
                    Cancel
                  </button>
                  <button type="button" className="primary" onClick={confirmStatusChange}>
                    Update Status
                  </button>
                </>
              ) : statusDialog.type === "save-note" ? (
                <>
                  <button type="button" onClick={() => setStatusDialog(null)}>
                    Cancel
                  </button>
                  <button type="button" className="primary" onClick={confirmSaveNote}>
                    Save Note
                  </button>
                </>
              ) : (
                <button type="button" className="primary" onClick={() => setStatusDialog(null)}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, icon, children }) {
  return (
    <section className="application-detail-card">
      <div className="application-section-title compact">
        <span className="application-section-icon">{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ items }) {
  return (
    <div className="application-info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <strong>{label}</strong>
          <span>{value || "Not provided"}</span>
        </div>
      ))}
    </div>
  );
}

function serializeApplication(application, index) {
  const fullName = application.fullName || "Unnamed Applicant";
  const salaryType = application.salaryType || "Per Month";

  return {
    id: application._id.toString(),
    initials: getInitials(fullName),
    avatarTone: avatarTones[index % avatarTones.length],
    name: fullName,
    email: application.email || "No email",
    phone: application.phone || "No phone",
    experience: application.experience || "Not provided",
    availableStart: formatDate(application.availableStart),
    appliedFor: application.job?.jobTitle || "Job not found",
    expectedSalary: formatSalary(application.expectedSalary, salaryType),
    status: statusLabels[application.status] || "New",
    statusKey: application.status || "unlisted",
    currentCity: application.currentCity || "Not provided",
    linkedin: application.linkedin || "Not provided",
    qualification: application.qualification || "Not provided",
    salaryType,
    skills: Array.isArray(application.skills) ? application.skills : [],
    appliedOn: formatDate(application.createdAt),
    savedNotes: formatSavedNotes(application.notes),
    timeline: buildTimeline(application),
    hasResume: Boolean(application.resumeFileId),
    resumeFileName: application.resumeFileName || "No resume available",
    resumeFileSize: formatFileSize(application.resumeFileSize),
    resumeViewUrl: application.resumeFileId
      ? `/app/resume/${application._id.toString()}?view=1`
      : "",
    resumeDownloadUrl: application.resumeFileId
      ? `/app/resume/${application._id.toString()}?download=1`
      : "",
  };
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Not provided";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSalary(value, salaryType) {
  const salary = Number(value);

  if (!Number.isFinite(salary)) {
    return "Not provided";
  }

  return `Rs. ${salary.toLocaleString("en-IN")} (${salaryType})`;
}

function canMoveToStatus(currentStatus, nextStatus) {
  if (!workflowStatuses.includes(nextStatus) || currentStatus === nextStatus) {
    return false;
  }

  if (nextStatus === "rejected") {
    return currentStatus !== "rejected";
  }

  if (currentStatus === "rejected") {
    return false;
  }

  if (currentStatus === "face") {
    return nextStatus === "test";
  }

  const currentIndex = orderedWorkflowStatuses.indexOf(currentStatus);

  if (currentStatus === "unlisted" || currentIndex === -1) {
    return nextStatus === orderedWorkflowStatuses[0];
  }

  return nextStatus === orderedWorkflowStatuses[currentIndex + 1];
}

function formatSavedNotes(notes) {
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes
    .filter((entry) => entry?.note)
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 3)
    .map((entry) => ({
      note: entry.note,
      createdAt: formatDateTime(entry.createdAt),
    }));
}

function buildTimeline(application) {
  const history = Array.isArray(application.statusHistory)
    ? application.statusHistory
    : [];
  const hasAppliedEvent = history.some((event) => event?.status === "applied");
  const events = [];

  if (!hasAppliedEvent) {
    events.push({
      status: "applied",
      changedAt: application.createdAt,
    });
  }

  events.push(
    ...history
      .filter((event) => event?.status === "applied" || workflowStatuses.includes(event?.status))
      .map((event) => ({
        status: event.status,
        changedAt: event.changedAt || event.createdAt || application.createdAt,
        note: event.note || "",
      })),
  );

  if (
    application.status &&
    workflowStatuses.includes(application.status) &&
    !events.some((event) => event.status === application.status)
  ) {
    events.push({
      status: application.status,
      changedAt: application.updatedAt || application.createdAt,
    });
  }

  const sortedEvents = events.sort((left, right) => {
    const leftTime = new Date(left.changedAt || 0).getTime();
    const rightTime = new Date(right.changedAt || 0).getTime();
    return leftTime - rightTime;
  });
  const timeline = [];

  for (const event of sortedEvents) {
    const label = event.status === "applied" ? "Applied" : statusLabels[event.status];

    if (!label) {
      continue;
    }

    timeline.push({
      status: event.status,
      label,
      changedAt: formatDateTime(event.changedAt),
      description: getTimelineDescription(event.status),
      note: event.note || "",
      blink: event.status === "rejected" && application.status === "rejected",
    });

    if (event.status === "rejected") {
      break;
    }
  }

  return timeline;
}

function getTimelineDescription(status) {
  const descriptions = {
    applied: "Application submitted by candidate.",
    shortlist: "Application moved to shortlisted.",
    phone: "Application moved to phone.",
    test: "Application moved to test.",
    final: "Application moved to final.",
    hired: "Application moved to hired.",
    rejected: "Application rejected.",
  };

  return descriptions[status] || "Status updated.";
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return "Not provided";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return "No file uploaded";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}
