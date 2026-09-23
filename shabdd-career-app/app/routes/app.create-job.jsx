import { ObjectId } from "mongodb";
import { useState } from "react";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import { client, db } from "../mongodb.server";

const requiredFields = [
  "jobTitle",
  "department",
  "employmentType",
  "shiftSchedule",
  "jobDescription",
  "jobResponsibilities",
  "location",
  "qualification",
  "workExperience",
  "primaryRequirements",
];

const textFields = [
  "jobTitle",
  "department",
  "employmentType",
  "shiftSchedule",
  "jobDescription",
  "jobResponsibilities",
  "paymentType",
  "currency",
  "location",
  "jobAddress",
  "benefits",
  "qualification",
  "primaryRequirements",
  "workExperience",
  "preferredRequirements",
  "additionalNotes",
];

const numberFields = [
  "numberOfOpenings",
  "minimumSalary",
  "maximumSalary",
];

const emptyFormData = {
  jobTitle: "",
  department: "",
  employmentType: "",
  shiftSchedule: "",
  applicationDeadline: "",
  numberOfOpenings: "",

  jobDescription: "",
  jobResponsibilities: "",

  minimumSalary: "",
  maximumSalary: "",
  paymentType: "",
  currency: "INR",

  location: "",
  jobAddress: "",
  benefits: "",

  qualification: "",
  primaryRequirements: "",
  workExperience: "",
  preferredRequirements: "",
  additionalNotes: "",
};

const currencyOptions = [
  ["AED", "د.إ"],
  ["AFN", "؋"],
  ["ALL", "L"],
  ["AMD", "֏"],
  ["ANG", "ƒ"],
  ["ARS", "$"],
  ["AUD", "$"],
  ["AZN", "₼"],
  ["BAM", "KM"],
  ["BDT", "৳"],
  ["BGN", "лв"],
  ["BHD", ".د.ب"],
  ["BND", "$"],
  ["BOB", "Bs"],
  ["BRL", "R$"],
  ["CAD", "$"],
  ["CHF", "CHF"],
  ["CLP", "$"],
  ["CNY", "¥"],
  ["COP", "$"],
  ["CRC", "₡"],
  ["CZK", "Kč"],
  ["DKK", "kr"],
  ["DOP", "RD$"],
  ["DZD", "د.ج"],
  ["EGP", "£"],
  ["ETB", "Br"],
  ["EUR", "€"],
  ["GBP", "£"],
  ["GEL", "₾"],
  ["GHS", "₵"],
  ["HKD", "$"],
  ["HUF", "Ft"],
  ["IDR", "Rp"],
  ["ILS", "₪"],
  ["INR", "₹"],
  ["IQD", "ع.د"],
  ["JPY", "¥"],
  ["KES", "KSh"],
  ["KRW", "₩"],
  ["KWD", "د.ك"],
  ["KZT", "₸"],
  ["LKR", "Rs"],
  ["MAD", "د.م."],
  ["MMK", "K"],
  ["MUR", "₨"],
  ["MXN", "$"],
  ["MYR", "RM"],
  ["NGN", "₦"],
  ["NOK", "kr"],
  ["NPR", "₨"],
  ["NZD", "$"],
  ["OMR", "ر.ع."],
  ["PEN", "S/"],
  ["PHP", "₱"],
  ["PKR", "₨"],
  ["PLN", "zł"],
  ["QAR", "ر.ق"],
  ["RON", "lei"],
  ["RSD", "дин"],
  ["RUB", "₽"],
  ["SAR", "﷼"],
  ["SEK", "kr"],
  ["SGD", "$"],
  ["THB", "฿"],
  ["TRY", "₺"],
  ["TWD", "NT$"],
  ["UAH", "₴"],
  ["USD", "$"],
  ["VND", "₫"],
  ["XAF", "FCFA"],
  ["XOF", "CFA"],
  ["ZAR", "R"],
];

function getCurrencySymbol(currencyCode) {
  return (
    currencyOptions.find(([code]) => code === currencyCode)?.[1] ||
    currencyCode ||
    ""
  );
}

function getText(formData, fieldName) {
  return String(formData.get(fieldName) || "").trim();
}

function getNumber(formData, fieldName) {
  const value = getText(formData, fieldName);

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function buildJobData(formData) {
  const applicationDeadline = getText(formData, "applicationDeadline");
  const jobData = {
    applicationDeadline: applicationDeadline
      ? new Date(applicationDeadline)
      : null,
    updatedAt: new Date(),
  };

  for (const fieldName of textFields) {
    jobData[fieldName] = getText(formData, fieldName);
  }

  for (const fieldName of numberFields) {
    jobData[fieldName] = getNumber(formData, fieldName);
  }

  return jobData;
}

function serializeJob(job) {
  if (!job) {
    return null;
  }

  return {
    id: job._id.toString(),
    jobTitle: job.jobTitle || "",
    department: job.department || "",
    employmentType: job.employmentType || "",
    shiftSchedule: job.shiftSchedule || "",
    applicationDeadline: job.applicationDeadline
      ? job.applicationDeadline.toISOString().slice(0, 10)
      : "",
    numberOfOpenings: job.numberOfOpenings?.toString() || "",
    jobDescription: job.jobDescription || "",
    jobResponsibilities: job.jobResponsibilities || "",
    minimumSalary: job.minimumSalary?.toString() || "",
    maximumSalary: job.maximumSalary?.toString() || "",
    paymentType: job.paymentType || "",
    currency: job.currency || "INR",
    location: job.location || "",
    jobAddress: job.jobAddress || "",
    benefits: job.benefits || "",
    qualification: job.qualification || "",
    primaryRequirements: job.primaryRequirements || "",
    workExperience: job.workExperience || "",
    preferredRequirements: job.preferredRequirements || "",
    additionalNotes: job.additionalNotes || "",
  };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return { job: null };
  }

  if (!ObjectId.isValid(jobId)) {
    return redirect("/app/job-list");
  }

  await client.connect();

  const job = await db.collection("jobs").findOne({
    _id: new ObjectId(jobId),
    shopId: session.shop,
  });

  if (!job) {
    return redirect("/app/job-list");
  }

  return { job: serializeJob(job) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const formData = await request.formData();
  const errors = {};

  for (const fieldName of requiredFields) {
    if (!getText(formData, fieldName)) {
      errors[fieldName] = "This field is required.";
    }
  }

  for (const fieldName of numberFields) {
    const value = getText(formData, fieldName);

    if (value && !Number.isFinite(Number(value))) {
      errors[fieldName] = "Please enter a valid number.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const now = new Date();
  const jobData = buildJobData(formData);

  await client.connect();

  if (jobId) {
    if (!ObjectId.isValid(jobId)) {
      return { errors: { jobId: "Invalid job id." } };
    }

    await db.collection("jobs").updateOne(
      {
        _id: new ObjectId(jobId),
        shopId: session.shop,
      },
      {
        $set: jobData,
      },
    );

    return redirect("/app/job-list");
  }

  await db.collection("jobs").insertOne({
    ...jobData,
    shopId: session.shop,
    status: "published",
    createdAt: now,
  });

  return redirect("/app/job-list");
};

export default function CreateJob() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const { job } = useLoaderData();
  const actionData = useActionData();
  const isEditMode = Boolean(job);
  const isPublishing = navigation.state === "submitting";

  // Current form step
  const [currentStep, setCurrentStep] = useState(1);

  // Temporary frontend form data
  const [formData, setFormData] = useState(() => ({
    ...emptyFormData,
    ...(job || {}),
  }));

  // Handle every input
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  // Go to next step
  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep((previousStep) => previousStep + 1);
    }
  };

  // Go to previous step
  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((previousStep) => previousStep - 1);
    }
  };

  const publishJob = () => {
    const data = new FormData();

    for (const [key, value] of Object.entries(formData)) {
      data.append(key, value);
    }

    submit(data, { method: "post" });
  };

  return (
    <s-page>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .create-job-page {
          width: 100%;
          min-height: 100vh;
          padding: 18px 20px 30px;
          background: #f6f7f8;
        }

        .create-job-title {
          margin: 0 0 16px;
          font-size: 20px;
          font-weight: 700;
          color: #202223;
        }

        .form-card {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 10px;
          overflow: hidden;
        }

        /* =========================
           STEPS
        ========================= */

        .steps-wrapper {
          padding: 18px 28px 22px;
          background: #dff3ff;
        }

        .steps {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          position: relative;
        }

        .steps::before {
          content: "";
          position: absolute;
          top: 28px;
          left: 8%;
          right: 8%;
          height: 2px;
          background: #bcc4cc;
          z-index: 1;
        }

        .step {
          width: 25%;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 2;
        }

        .step-title {
          min-height: 20px;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #6d7175;
          text-align: center;
        }

        .step-circle {
          width: 23px;
          height: 23px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 2px solid #aeb4bd;
          border-radius: 50%;

          background: #ffffff;
          color: #777;

          font-size: 10px;
          font-weight: 700;
        }

        .step.active .step-title {
          color: #243aa5;
        }

        .step.active .step-circle {
          border-color: #3047b5;
          background: #3047b5;
          color: #ffffff;
        }

        .step.completed .step-circle {
          border-color: #3047b5;
          background: #3047b5;
          color: #ffffff;
        }

        .step.completed .step-title {
          color: #3047b5;
        }

        /* =========================
           FORM
        ========================= */

        .form-content {
          padding: 24px;
        }

        .section-title {
          margin: 0;
          padding-bottom: 12px;

          border-bottom: 1px solid #dfe3e8;

          color: #243aa5;
          font-size: 14px;
          font-weight: 700;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px 16px;
          margin-top: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-label {
          color: #202223;
          font-size: 12px;
          font-weight: 600;
        }

        .required {
          color: #d72c0d;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;

          padding: 0 12px;

          border: 1px solid #b9bec5;
          border-radius: 7px;

          background: #ffffff;
          color: #303030;

          font-family: Inter, sans-serif;
          font-size: 13px;

          outline: none;
        }

        .form-input,
        .form-select {
          height: 40px;
        }

        .form-textarea {
          min-height: 110px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #3047b5;
          box-shadow: 0 0 0 1px #3047b5;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #9a9ea4;
        }

        /* =========================
           SALARY
        ========================= */

        .salary-box {
          grid-column: 1 / -1;

          padding: 16px;

          border: 1px solid #e1e3e5;
          border-radius: 8px;

          background: #fafafa;
        }

        .salary-title {
          margin: 0 0 15px;
          font-size: 13px;
          font-weight: 700;
          color: #202223;
        }

        .salary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        /* =========================
           BUTTONS
        ========================= */

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-top: 28px;
          padding-top: 18px;

          border-top: 1px solid #eeeeee;
        }

        .back-btn,
        .next-btn {
          height: 38px;
          padding: 0 18px;

          border-radius: 7px;

          font-size: 13px;
          font-weight: 600;

          cursor: pointer;
        }

        .back-btn {
          border: 1px solid #c9cccf;
          background: #ffffff;
          color: #303030;
        }

        .back-btn:hover {
          background: #f5f5f5;
        }

        .next-btn {
          border: none;
          background: #303030;
          color: #ffffff;
        }

        .next-btn:hover {
          background: #1f1f1f;
        }

        .publish-btn {
          background: #3047b5;
        }

        .publish-btn:hover {
          background: #24358e;
        }

        /* =========================
           REVIEW
        ========================= */

        .review-section {
          margin-top: 20px;
          padding: 16px;

          border: 1px solid #e1e3e5;
          border-radius: 8px;

          background: #fafafa;
        }

        .review-heading {
          margin: 0 0 15px;

          color: #202223;
          font-size: 14px;
          font-weight: 700;
        }

        .review-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .review-item {
          padding-bottom: 10px;
          border-bottom: 1px solid #eeeeee;
        }

        .review-label {
          display: block;
          margin-bottom: 4px;

          color: #6d7175;
          font-size: 11px;
          font-weight: 600;
        }

        .review-value {
          color: #202223;
          font-size: 13px;
          white-space: pre-wrap;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 800px) {
          .create-job-page {
            padding: 12px;
          }

          .form-content {
            padding: 16px;
          }

          .steps-wrapper {
            overflow-x: auto;
            padding: 16px 8px 20px;
          }

          .steps {
            min-width: 580px;
          }

          .form-grid,
          .review-grid {
            grid-template-columns: 1fr;
          }

          .salary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 500px) {
          .salary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="create-job-page">

        <h1 className="create-job-title">
          {isEditMode ? "Edit Job Post" : "Create Job Post"}
        </h1>

        <div className="form-card">

          {/* =========================
              STEP INDICATOR
          ========================= */}

          <div className="steps-wrapper">

            <div className="steps">

              <div
                className={`step ${
                  currentStep === 1
                    ? "active"
                    : currentStep > 1
                      ? "completed"
                      : ""
                }`}
              >
                <div className="step-title">
                  Basic Info
                </div>

                <div className="step-circle">
                  {currentStep > 1 ? "✓" : "1"}
                </div>
              </div>

              <div
                className={`step ${
                  currentStep === 2
                    ? "active"
                    : currentStep > 2
                      ? "completed"
                      : ""
                }`}
              >
                <div className="step-title">
                  Role Description
                </div>

                <div className="step-circle">
                  {currentStep > 2 ? "✓" : "2"}
                </div>
              </div>

              <div
                className={`step ${
                  currentStep === 3
                    ? "active"
                    : currentStep > 3
                      ? "completed"
                      : ""
                }`}
              >
                <div className="step-title">
                  Skills & Requirements
                </div>

                <div className="step-circle">
                  {currentStep > 3 ? "✓" : "3"}
                </div>
              </div>

              <div
                className={`step ${
                  currentStep === 4 ? "active" : ""
                }`}
              >
                <div className="step-title">
                  Review & Publish
                </div>

                <div className="step-circle">
                  4
                </div>
              </div>

            </div>

          </div>

          {/* =====================================================
              STEP 1 - BASIC INFO
          ====================================================== */}

          {currentStep === 1 && (
            <div className="form-content">

              <h2 className="section-title">
                Primary Job Information
              </h2>

              <div className="form-grid">

                <div className="form-group">
                  <label className="form-label">
                    Job Title <span className="required">*</span>
                  </label>

                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Web Developer"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Job Department <span className="required">*</span>
                  </label>

                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select department
                    </option>

                    <option value="Engineering">
                      Engineering
                    </option>

                    <option value="Technology">
                      Technology
                    </option>

                    <option value="Marketing">
                      Marketing
                    </option>

                    <option value="Sales">
                      Sales
                    </option>

                    <option value="Design">
                      Design
                    </option>

                    <option value="Human Resources">
                      Human Resources
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Employment Type <span className="required">*</span>
                  </label>

                  <select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select employment type
                    </option>

                    <option value="Full-Time">
                      Full-Time
                    </option>

                    <option value="Part-Time">
                      Part-Time
                    </option>

                    <option value="Contract">
                      Contract
                    </option>

                    <option value="Internship">
                      Internship
                    </option>

                    <option value="Temporary">
                      Temporary
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Shift Schedule <span className="required">*</span>
                  </label>

                  <select
                    name="shiftSchedule"
                    value={formData.shiftSchedule}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select shift
                    </option>

                    <option value="Day Shift">
                      Day Shift
                    </option>

                    <option value="Night Shift">
                      Night Shift
                    </option>

                    <option value="Rotational Shift">
                      Rotational Shift
                    </option>

                    <option value="Flexible Shift">
                      Flexible Shift
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Application Deadline
                  </label>

                  <input
                    type="date"
                    name="applicationDeadline"
                    value={formData.applicationDeadline}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Number of Openings
                  </label>

                  <input
                    type="number"
                    name="numberOfOpenings"
                    value={formData.numberOfOpenings}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. 2"
                    min="1"
                  />
                </div>

              </div>

              <div className="form-footer">

                <button
                  type="button"
                  className="back-btn"
                  onClick={() => navigate("/app/job-list")}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="next-btn"
                  onClick={nextStep}
                >
                  Next →
                </button>

              </div>

            </div>
          )}

          {/* =====================================================
              STEP 2 - ROLE DESCRIPTION
          ====================================================== */}

          {currentStep === 2 && (
            <div className="form-content">

              <h2 className="section-title">
                Role Description
              </h2>

              <div className="form-grid">

                <div className="form-group full-width">
                  <label className="form-label">
                    Job Description <span className="required">*</span>
                  </label>

                  <textarea
                    name="jobDescription"
                    value={formData.jobDescription}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Describe the job role..."
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Job Responsibilities <span className="required">*</span>
                  </label>

                  <textarea
                    name="jobResponsibilities"
                    value={formData.jobResponsibilities}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Enter the main job responsibilities..."
                  />
                </div>

                {/* SALARY */}

                <div className="salary-box">

                  <h3 className="salary-title">
                    Salary Information <span className="required">*</span>
                  </h3>

                  <div className="salary-grid">

                    <div className="form-group">
                      <label className="form-label">
                        Minimum Salary
                      </label>

                      <input
                        type="number"
                        name="minimumSalary"
                        value={formData.minimumSalary}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="25000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Maximum Salary
                      </label>

                      <input
                        type="number"
                        name="maximumSalary"
                        value={formData.maximumSalary}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="50000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Payment Type
                      </label>

                      <select
                        name="paymentType"
                        value={formData.paymentType}
                        onChange={handleChange}
                        className="form-select"
                      >
                        <option value="">
                          Select
                        </option>

                        <option value="Monthly">
                          Monthly
                        </option>

                        <option value="Yearly">
                          Yearly
                        </option>

                        <option value="Hourly">
                          Hourly
                        </option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Currency
                      </label>

                      <select
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="form-select"
                      >
                        {currencyOptions.map(([code, symbol]) => (
                          <option key={code} value={code}>
                            {code} {symbol}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                </div>

                {/* LOCATION */}

                <div className="form-group">
                  <label className="form-label">
                    Location <span className="required">*</span>
                  </label>

                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select location type
                    </option>

                    <option value="Hybrid">
                      Hybrid
                    </option>

                    <option value="On Site">
                      On Site
                    </option>

                    <option value="Remote">
                      Remote
                    </option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Job Address
                  </label>

                  <textarea
                    name="jobAddress"
                    value={formData.jobAddress}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Enter full job address"
                  />
                </div>

                {/* BENEFITS */}

                <div className="form-group">
                  <label className="form-label">
                    Benefits
                  </label>

                  <textarea
                    type="text"
                    name="benefits"
                    value={formData.benefits}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g. Health insurance, paid leave"
                  />
                </div>

              </div>

              <div className="form-footer">

                <button
                  type="button"
                  className="back-btn"
                  onClick={previousStep}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="next-btn"
                  onClick={nextStep}
                >
                  Next →
                </button>

              </div>

            </div>
          )}

          {/* =====================================================
              STEP 3 - SKILLS & REQUIREMENTS
          ====================================================== */}

          {currentStep === 3 && (
            <div className="form-content">

              <h2 className="section-title">
                Skills & Requirements
              </h2>

              <div className="form-grid">

                <div className="form-group">
                  <label className="form-label">
                    Preferred Qualifications{" "}
                    <span className="required">*</span>
                  </label>

                  <select
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select qualification
                    </option>

                    <option value="Bachelor's">
                      Bachelor's
                    </option>

                    <option value="Master's">
                      Master's
                    </option>

                    <option value="Diploma">
                      Diploma
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Work Experience <span className="required">*</span>
                  </label>

                  <select
                    name="workExperience"
                    value={formData.workExperience}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      Select experience
                    </option>

                    <option value="Fresher">
                      Fresher
                    </option>

                    <option value="1 Year">
                      1 Year
                    </option>

                    <option value="2 Years">
                      2 Years
                    </option>

                    <option value="3 Years">
                      3 Years
                    </option>

                    <option value="4+ Years">
                      4+ Years
                    </option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Primary Requirements{" "}
                    <span className="required">*</span>
                  </label>

                  <textarea
                    name="primaryRequirements"
                    value={formData.primaryRequirements}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Enter required skills and requirements..."
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Preferred Requirements
                  </label>

                  <textarea
                    name="preferredRequirements"
                    value={formData.preferredRequirements}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Enter preferred skills or qualifications..."
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    Additional Notes
                  </label>

                  <textarea
                    name="additionalNotes"
                    value={formData.additionalNotes}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Add any additional information..."
                  />
                </div>

              </div>

              <div className="form-footer">

                <button
                  type="button"
                  className="back-btn"
                  onClick={previousStep}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="next-btn"
                  onClick={nextStep}
                >
                  Review →
                </button>

              </div>

            </div>
          )}

          {/* =====================================================
              STEP 4 - REVIEW
          ====================================================== */}

          {currentStep === 4 && (
            <div className="form-content">

              <h2 className="section-title">
                Review & Publish
              </h2>

              {actionData?.errors && (
                <div className="review-section">
                  <h3 className="review-heading">
                    Please complete required fields
                  </h3>

                  <div className="review-value">
                    Go back and fill all required fields marked with *.
                  </div>
                </div>
              )}

              <div className="review-section">

                <h3 className="review-heading">
                  Basic Information
                </h3>

                <div className="review-grid">

                  <ReviewItem
                    label="Job Title"
                    value={formData.jobTitle}
                  />

                  <ReviewItem
                    label="Department"
                    value={formData.department}
                  />

                  <ReviewItem
                    label="Employment Type"
                    value={formData.employmentType}
                  />

                  <ReviewItem
                    label="Shift Schedule"
                    value={formData.shiftSchedule}
                  />

                  <ReviewItem
                    label="Application Deadline"
                    value={formData.applicationDeadline}
                  />

                  <ReviewItem
                    label="Number of Openings"
                    value={formData.numberOfOpenings}
                  />

                </div>

              </div>

              <div className="review-section">

                <h3 className="review-heading">
                  Role Description
                </h3>

                <div className="review-grid">

                  <ReviewItem
                    label="Job Description"
                    value={formData.jobDescription}
                  />

                  <ReviewItem
                    label="Job Responsibilities"
                    value={formData.jobResponsibilities}
                  />

                  <ReviewItem
                    label="Salary"
                    value={
                      formData.minimumSalary ||
                      formData.maximumSalary
                        ? `${formData.currency} ${getCurrencySymbol(formData.currency)} ${formData.minimumSalary || "-"} - ${formData.maximumSalary || "-"} ${formData.paymentType}`
                        : ""
                    }
                  />

                  <ReviewItem
                    label="Location"
                    value={formData.location}
                  />

                  <ReviewItem
                    label="Job Address"
                    value={formData.jobAddress}
                  />

                  <ReviewItem
                    label="Benefits"
                    value={formData.benefits}
                  />

                </div>

              </div>

              <div className="review-section">

                <h3 className="review-heading">
                  Skills & Requirements
                </h3>

                <div className="review-grid">

                  <ReviewItem
                    label="Preferred Qualification"
                    value={formData.qualification}
                  />

                  <ReviewItem
                    label="Work Experience"
                    value={formData.workExperience}
                  />

                  <ReviewItem
                    label="Primary Requirements"
                    value={formData.primaryRequirements}
                  />

                  <ReviewItem
                    label="Preferred Requirements"
                    value={formData.preferredRequirements}
                  />

                  <ReviewItem
                    label="Additional Notes"
                    value={formData.additionalNotes}
                  />

                </div>

              </div>

              <div className="form-footer">

                <button
                  type="button"
                  className="back-btn"
                  onClick={previousStep}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="next-btn publish-btn"
                  onClick={publishJob}
                  disabled={isPublishing}
                >
                  {isPublishing
                    ? isEditMode
                      ? "Updating..."
                      : "Publishing..."
                    : isEditMode
                      ? "Update Job"
                      : "Publish Job"}
                </button>

              </div>

            </div>
          )}

        </div>

      </div>
    </s-page>
  );
}


/* =========================================================
   REVIEW ITEM COMPONENT
========================================================= */

function ReviewItem({ label, value }) {
  return (
    <div className="review-item">

      <span className="review-label">
        {label}
      </span>

      <div className="review-value">
        {value || "Not provided"}
      </div>

    </div>
  );
}
