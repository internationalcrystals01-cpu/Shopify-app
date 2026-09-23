/* eslint-disable react/prop-types */

import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";

export default function ApplicationForm({ job }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const fileInputRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [isSuccessNoticeOpen, setIsSuccessNoticeOpen] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      setIsSuccessNoticeOpen(true);

      const refreshTimer = window.setTimeout(() => {
        window.location.reload();
      }, 2000);

      return () => window.clearTimeout(refreshTimer);
    }
  }, [actionData]);

  const chooseResume = () => {
    fileInputRef.current?.click();
  };

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0];
    setResumeFile(file || null);
  };

  const removeResume = () => {
    setResumeFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="candidate-apply-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f6f9fd;
          color: #071436;
          font-family: Inter, sans-serif;
        }

        .candidate-apply-page {
          min-height: 100vh;
          padding: 18px 20px 34px;
          background: linear-gradient(180deg, #f7fbff 0%, #f4f8fc 100%);
        }

        .candidate-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .candidate-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 4px;
          color: #0f56c7;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .candidate-heading {
          margin: 0;
          color: #071436;
          font-size: 30px;
          line-height: 38px;
          font-weight: 800;
          text-align: center;
        }

        .candidate-subtitle {
          margin: 6px 0 16px;
          color: #4b587c;
          font-size: 14px;
          text-align: center;
        }

        .candidate-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: start;
        }

        .candidate-main {
          display: grid;
          gap: 12px;
        }

        .candidate-card,
        .candidate-side-card {
          border: 1px solid #dfe7f2;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 14px 38px rgba(15, 23, 42, 0.04);
        }

        .job-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 22px;
        }

        .candidate-section {
          padding: 18px 24px 20px;
        }

        .section-heading {
          display: flex;
          gap: 14px;
          margin-bottom: 16px;
        }

        .section-icon,
        .job-icon,
        .side-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 8px;
          background: #eef5ff;
          color: #145de0;
          font-weight: 800;
        }

        .job-icon {
          width: 52px;
          height: 52px;
          font-size: 20px;
        }

        .section-icon {
          width: 38px;
          height: 38px;
          font-size: 15px;
        }

        .side-icon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
        }

        .section-title,
        .side-title,
        .job-title {
          margin: 0;
          color: #071436;
          font-weight: 800;
        }

        .section-title {
          font-size: 18px;
        }

        .section-copy,
        .side-copy {
          margin: 4px 0 0;
          color: #4b587c;
          font-size: 13px;
          line-height: 20px;
        }

        .job-title {
          font-size: 19px;
        }

        .job-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 8px;
        }

        .job-address {
          margin: 9px 0 0;
          color: #4b587c;
          font-size: 13px;
          line-height: 20px;
        }

        .job-tag {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 3px 10px;
          border: 1px solid #d6dfec;
          border-radius: 6px;
          background: #f8fbff;
          color: #071436;
          font-size: 12px;
          font-weight: 700;
        }

        .candidate-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 26px;
        }

        .candidate-field {
          display: grid;
          gap: 7px;
        }

        .candidate-field.full {
          grid-column: 1 / -1;
        }

        .candidate-label {
          color: #071436;
          font-size: 13px;
          font-weight: 800;
        }

        .required {
          color: #e11d2f;
        }

        .candidate-input,
        .candidate-select,
        .candidate-textarea {
          width: 100%;
          border: 1px solid #cfd8e6;
          border-radius: 7px;
          background: #ffffff;
          color: #071436;
          font: inherit;
          font-size: 14px;
          outline: none;
        }

        .candidate-input,
        .candidate-select {
          height: 38px;
          padding: 0 11px;
        }

        .candidate-textarea {
          min-height: 76px;
          padding: 11px;
          resize: vertical;
        }

        .candidate-input:focus,
        .candidate-select:focus,
        .candidate-textarea:focus {
          border-color: #145de0;
          box-shadow: 0 0 0 2px rgba(20, 93, 224, 0.1);
        }

        .salary-input-wrap {
          display: flex;
        }

        .salary-prefix {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          border: 1px solid #cfd8e6;
          border-right: 0;
          border-radius: 7px 0 0 7px;
          background: #f8fbff;
          color: #071436;
          font-weight: 800;
        }

        .salary-input-wrap .candidate-input {
          border-radius: 0 7px 7px 0;
        }

        .field-note,
        .character-count {
          color: #4b587c;
          font-size: 12px;
        }

        .character-count {
          margin-top: 7px;
          text-align: right;
        }

        .resume-dropzone {
          display: grid;
          place-items: center;
          min-height: 142px;
          padding: 18px;
          border: 1px dashed #9fb0c8;
          border-radius: 7px;
          background: #fbfdff;
          text-align: center;
        }

        .resume-upload-btn {
          border: 0;
          background: transparent;
          color: #145de0;
          cursor: pointer;
          font-weight: 800;
        }

        .resume-title {
          margin: 7px 0 0;
          font-size: 14px;
          font-weight: 800;
        }

        .resume-meta {
          margin: 5px 0 0;
          color: #4b587c;
          font-size: 12px;
        }

        .resume-file {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          margin-top: 16px;
          padding: 10px 12px;
          border: 1px solid #dfe7f2;
          border-radius: 7px;
          background: #ffffff;
          text-align: left;
        }

        .resume-file-name {
          display: block;
          color: #071436;
          font-size: 13px;
          font-weight: 800;
        }

        .resume-remove {
          height: 32px;
          padding: 0 14px;
          border: 1px solid #d6dfec;
          border-radius: 6px;
          background: #ffffff;
          color: #071436;
          cursor: pointer;
          font-weight: 700;
        }

        .consent-row {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 14px;
          color: #071436;
          font-size: 13px;
        }

        .submit-wrap {
          display: grid;
          justify-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        .submit-btn {
          width: min(290px, 100%);
          height: 42px;
          border: 0;
          border-radius: 7px;
          background: #145de0;
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
        }

        .submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .legal-copy {
          margin: 0;
          color: #4b587c;
          font-size: 11px;
          text-align: center;
        }

        .candidate-alert {
          padding: 12px 14px;
          border-radius: 7px;
          font-size: 14px;
          font-weight: 700;
        }

        .candidate-alert.success {
          border: 1px solid #b5ead2;
          background: #ecfdf5;
          color: #08784f;
        }

        .candidate-alert.error {
          border: 1px solid #fecdd3;
          background: #fff1f2;
          color: #be123c;
        }

        .candidate-success-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(7, 20, 54, 0.42);
        }

        .candidate-success-modal {
          width: min(420px, 100%);
          padding: 30px 28px;
          border: 1px solid #b5ead2;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 28px 90px rgba(7, 20, 54, 0.28);
          text-align: center;
        }

        .candidate-success-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          margin-bottom: 16px;
          border-radius: 50%;
          background: #dcfce7;
          color: #15803d;
          font-size: 30px;
          font-weight: 900;
        }

        .candidate-success-modal h2 {
          margin: 0;
          color: #071436;
          font-size: 22px;
          line-height: 28px;
          font-weight: 850;
        }

        .candidate-success-modal p {
          margin: 8px 0 22px;
          color: #4b587c;
          font-size: 14px;
          line-height: 21px;
        }

        .candidate-sidebar {
          display: grid;
          gap: 18px;
        }

        .candidate-side-card {
          padding: 22px;
        }

        .side-item {
          display: flex;
          gap: 14px;
          margin-top: 22px;
        }

        .side-item:first-child {
          margin-top: 0;
        }

        .safe-card {
          background: #eefcf6;
          border-color: #c8f2df;
        }

        @media (max-width: 980px) {
          .candidate-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .candidate-apply-page {
            padding: 14px;
          }

          .candidate-heading {
            font-size: 25px;
          }

          .job-summary,
          .candidate-section {
            padding: 16px;
          }

          .candidate-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
        }
      `}</style>

      {actionData?.success && isSuccessNoticeOpen && (
        <div className="candidate-success-overlay" role="dialog" aria-modal="true">
          <div className="candidate-success-modal">
            <span className="candidate-success-icon" aria-hidden="true">✓</span>
            <h2>Your application has been submitted.</h2>
            <p>Thank you. We have received your application successfully.</p>
          </div>
        </div>
      )}

      <div className="candidate-shell">
        <a className="candidate-back" href="/">
          &lt; Back to Jobs
        </a>

        <h1 className="candidate-heading">Apply for this position</h1>
        <p className="candidate-subtitle">
          We are excited that you are interested in joining our team!
        </p>

        <div className="candidate-layout">
          <main className="candidate-main">
            {actionData?.error && (
              <div className="candidate-alert error">{actionData.error}</div>
            )}

            <section className="candidate-card job-summary">
              <span className="job-icon">JOB</span>
              <div>
                <h2 className="job-title">{job.jobTitle}</h2>
                <div className="job-tags">
                  <span className="job-tag">{job.department}</span>
                  <span className="job-tag">{job.employmentType}</span>
                  <span className="job-tag">{job.location}</span>
                  <span className="job-tag">{job.shiftSchedule}</span>
                </div>
                {job.jobAddress && (
                  <p className="job-address">{job.jobAddress}</p>
                )}
              </div>
            </section>

            <Form method="post" encType="multipart/form-data" className="candidate-main">
              <Section title="Personal Information" copy="Tell us about yourself" icon="PI">
                <div className="candidate-grid">
                  <Field label="Full Name" required name="fullName" />
                  <Field label="Email Address" required name="email" type="email" />
                  <Field label="Phone Number" required name="phone" placeholder="Phone No" />
                  <Field label="Current City / Location" name="currentCity" placeholder="Enter your current city" />
                  <Field label="LinkedIn Profile" name="linkedin" placeholder="https://linkedin.com/in/yourprofile" />
                </div>
              </Section>

              <Section title="Professional Information" copy="Share your professional details" icon="PRO">
                <div className="candidate-grid">
                  <SelectField label="Work Experience" required name="experience" options={["Fresher", "1 Year", "2 Years", "3 Years", "4+ Years"]} />
                  <SelectField label="Highest Qualification" required name="qualification" options={["Diploma", "Bachelor's", "Master's", "Other"]} />
                  <Field label="Available Start Date" required name="availableStart" type="date" />
                  <div className="candidate-field">
                    <label className="candidate-label" htmlFor="expectedSalary">
                      Expected Salary <span className="required">*</span>
                    </label>
                    <div className="salary-input-wrap">
                      <span className="salary-prefix">Rs</span>
                      <input id="expectedSalary" className="candidate-input" name="expectedSalary" type="number" min="0" placeholder="Enter expected salary" required />
                    </div>
                  </div>
                  <SelectField label="Salary Period" name="salaryType" defaultValue="Per Month" options={["Per Month", "Per Year", "Per Hour"]} />
                  <div className="candidate-field full">
                    <label className="candidate-label" htmlFor="skills">
                      Skills <span className="required">*</span>
                    </label>
                    <input id="skills" className="candidate-input" name="skills" placeholder="e.g. React, Node.js, JavaScript, UI/UX" required />
                    <span className="field-note">Enter skills separated by commas</span>
                  </div>
                </div>
              </Section>

              <Section title="Resume" copy="Upload your resume (PDF only)" icon="PDF">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="resume"
                  accept="application/pdf"
                  hidden
                  onChange={handleResumeChange}
                />

                <div className="resume-dropzone">
                  <button type="button" className="resume-upload-btn" onClick={chooseResume}>
                    Upload PDF
                  </button>
                  <p className="resume-title">Drag and drop your resume here</p>
                  <p className="resume-meta">or click to browse</p>
                  <p className="resume-meta">PDF only - Maximum file size: 5 MB</p>

                  {resumeFile && (
                    <div className="resume-file">
                      <div>
                        <span className="resume-file-name">{resumeFile.name}</span>
                        <span className="resume-meta">{formatFileSize(resumeFile.size)}</span>
                      </div>
                      <button type="button" className="resume-remove" onClick={removeResume}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <label className="consent-row">
                  <input type="checkbox" name="consent" value="yes" required />
                  <span>I confirm that the information provided above is correct and complete.</span>
                </label>

                <div className="submit-wrap">
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </button>
                  <p className="legal-copy">
                    By submitting this application, you agree to our Privacy Policy and Terms of Service.
                  </p>
                </div>
              </Section>
            </Form>
          </main>

          <aside className="candidate-sidebar">
            <section className="candidate-side-card">
              <SideItem icon="CO" title="About Our Company">
                We are a fast-growing company building innovative solutions. Join our team and be part of an amazing journey.
              </SideItem>
              <SideItem icon="IN" title="Innovative Work">Work on cutting-edge projects</SideItem>
              <SideItem icon="GR" title="Growth Opportunities">Learn and grow your career</SideItem>
              <SideItem icon="FX" title="Flexible Work">Hybrid work environment</SideItem>
              <SideItem icon="TM" title="Great Team">Collaborative and supportive culture</SideItem>
            </section>

            <section className="candidate-side-card">
              <SideItem icon="?" title="Need Help?">
                If you have any questions about the application process, feel free to reach out to us.
              </SideItem>
              <SideItem icon="EM" title="careers@ourcompany.com" />
              <SideItem icon="PH" title="+91 98765 43210" />
              <SideItem icon="LO" title="Delhi, India" />
            </section>

            <section className="candidate-side-card safe-card">
              <SideItem icon="OK" title="Your Data is Safe">
                We respect your privacy. Your personal information will only be used for recruitment purposes.
              </SideItem>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ title, copy, icon, children }) {
  return (
    <section className="candidate-card candidate-section">
      <div className="section-heading">
        <span className="section-icon">{icon}</span>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-copy">{copy}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, name, required = false, type = "text", placeholder = "" }) {
  return (
    <div className="candidate-field">
      <label className="candidate-label" htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      <input
        id={name}
        className="candidate-input"
        name={name}
        type={type}
        placeholder={placeholder || `Enter your ${label.toLowerCase()}`}
        required={required}
      />
    </div>
  );
}

function SelectField({ label, name, options, required = false, defaultValue = "" }) {
  return (
    <div className="candidate-field">
      <label className="candidate-label" htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      <select
        id={name}
        className="candidate-select"
        name={name}
        required={required}
        defaultValue={defaultValue}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function SideItem({ icon, title, children }) {
  return (
    <div className="side-item">
      <span className="side-icon">{icon}</span>
      <div>
        <h3 className="side-title">{title}</h3>
        {children && <p className="side-copy">{children}</p>}
      </div>
    </div>
  );
}

function formatFileSize(size) {
  if (!size) {
    return "0 KB";
  }

  return `${Math.ceil(size / 1024)} KB`;
}
