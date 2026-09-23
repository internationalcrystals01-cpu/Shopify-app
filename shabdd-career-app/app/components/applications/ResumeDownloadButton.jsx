/* eslint-disable react/prop-types */

import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function ResumeDownloadButton({
  application,
  children,
  className = "application-icon-btn pdf",
  disabledLabel = "No Resume Available",
  onClick,
}) {
  const shopify = useAppBridge();
  const [isDownloading, setIsDownloading] = useState(false);
  const canDownload = application.hasResume && application.resumeDownloadUrl;

  const handleDownload = async (event) => {
    onClick?.(event);

    if (event.defaultPrevented || !canDownload || isDownloading) {
      return;
    }

    setIsDownloading(true);

    try {
      const token = await shopify.idToken();
      const response = await fetch(application.resumeDownloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const contentType = response.headers.get("Content-Type") || "";

      if (!response.ok || !contentType.includes("application/pdf")) {
        throw new Error(`Expected a PDF response, received ${response.status} ${contentType}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        getFilenameFromContentDisposition(response.headers.get("Content-Disposition")) ||
        normalizePdfFilename(application.resumeFileName);

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Resume download failed", error);
      shopify.toast.show("Resume download failed. Please try again.", {
        isError: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!canDownload) {
    return (
      <button
        type="button"
        className={`${className} disabled`}
        aria-label={`No resume PDF available for ${application.name}`}
        title="No resume PDF available"
        disabled
        onClick={onClick}
      >
        {children || disabledLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={`Download resume PDF for ${application.name}`}
      title="Download Resume (PDF)"
      disabled={isDownloading}
      onClick={handleDownload}
    >
      {children || "Download Resume"}
    </button>
  );
}

function normalizePdfFilename(filename) {
  const safeFilename = String(filename || "resume.pdf")
    .replaceAll("\\", "_")
    .replaceAll('"', "")
    .trim();

  return safeFilename.toLowerCase().endsWith(".pdf")
    ? safeFilename
    : `${safeFilename || "resume"}.pdf`;
}

function getFilenameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    return "";
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return normalizePdfFilename(decodeURIComponent(utf8Match[1]));
  }

  const asciiMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return asciiMatch?.[1] ? normalizePdfFilename(asciiMatch[1]) : "";
}
