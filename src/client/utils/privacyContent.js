const PRIVACY_SECTIONS = [
  {
    title: 'What This Notice Covers',
    body: [
      'How CitizenLink collects, uses, shares, and protects your personal data when you use our services.',
      'The choices available to you regarding the use of your information.',
      'How you can exercise your rights under Philippine data protection laws.'
    ]
  },
  {
    title: 'Information We Collect',
    body: [
      'Identity details such as your name, contact information, and barangay affiliation.',
      'Account credentials and metadata required to manage your profile.',
      'Complaint submissions including descriptions, media uploads, location details, and supporting evidence.',
      'Usage analytics (device, browser, timestamps) captured to secure the platform and improve performance.',
      'Communications you send to the LGU or support teams through CitizenLink.'
    ]
  },
  {
    title: 'Legal Basis for Processing',
    body: [
      'Compliance with legal and regulatory obligations of the Local Government Unit (LGU).',
      'Performance of a public task and delivery of responsive public service.',
      'Your explicit consent when you create an account, submit a complaint, or opt into optional services.',
      'Legitimate interests such as maintaining system security, preventing abuse, and improving service delivery.'
    ]
  },
  {
    title: 'How We Use Your Information',
    body: [
      'Validate your identity and communicate updates about your complaints.',
      'Route complaints to the appropriate LGU departments, coordinators, and officers.',
      'Generate analytics that help improve community services and resource allocation.',
      'Detect and prevent spam, fraud, or malicious submissions.',
      'Maintain audit trails required for accountability and transparency.'
    ]
  },
  {
    title: 'Sharing and Disclosure',
    body: [
      'Relevant LGU departments and officers who are assigned to investigate or resolve your complaint.',
      'Authorized complaint coordinators and administrators supporting case management.',
      'Service providers that supply secure infrastructure, cloud storage, mapping, notifications, and security tooling.',
      'Regulators or courts when disclosure is legally required.'
    ],
    note: 'We do not sell or lease personal data. Any sharing is strictly controlled, logged, and governed by data sharing agreements.'
  },
  {
    title: 'Data Retention',
    body: [
      'Complaint records are retained for as long as necessary to resolve the case, comply with archiving rules, and support auditing.',
      'Account information is retained while your account is active. You may request deletion when no longer needed, subject to legal and archival requirements.',
      'Activity logs that help with security investigations are retained for at least 12 months.'
    ]
  },
  {
    title: 'Data Security',
    body: [
      'Transport Layer Security (HTTPS) for data in transit.',
      'Encryption at rest for sensitive complaint evidence.',
      'Role-based access controls and mandatory authentication for LGU personnel.',
      'Continuous monitoring, rate-limiting, and anomaly detection to prevent abuse.',
      'Regular security reviews, vulnerability remediation, and audit logging.'
    ]
  },
  {
    title: 'Your Rights',
    body: [
      'Request access to the personal data we hold about you.',
      'Ask for corrections to inaccurate or outdated data.',
      'Request deletion when the data is no longer necessary or when consent is withdrawn.',
      'Object to or request restriction of processing in certain circumstances.',
      'Receive support in filing concerns with the National Privacy Commission (NPC).'
    ],
    note: 'To exercise your rights, contact the LGU Data Protection Officer (DPO) using the details below.'
  },
  {
    title: 'Cookies and Analytics',
    body: [
      'CitizenLink uses session cookies to keep you signed in securely.',
      'Essential analytics are collected to monitor service availability and detect outages.',
      'We do not use third-party advertising trackers.'
    ]
  },
  {
    title: 'Children\'s Privacy',
    body: [
      'CitizenLink is intended for use by adults and duly authorized representatives.',
      'If we learn that data from a minor was collected without guardian consent, we will take steps to delete it promptly.'
    ]
  },
  {
    title: 'Updates to This Notice',
    body: [
      'We may update this Privacy Notice to reflect changes in technology, regulation, or service improvements.',
      'We will indicate the date of the latest revision and provide advance notice for significant updates.'
    ]
  },
  {
    title: 'Contact and Data Protection Officer',
    body: [
      'Data Protection Officer, Digos City LGU',
      'Email: privacy@digoscity.gov.ph',
      'Phone: (082) 555-1234',
      'Address: Digos City Hall, Rizal Avenue, Digos City, Davao del Sur'
    ],
    note: 'For urgent concerns, you may also reach out through the CitizenLink support desk within the platform.'
  }
];

/**
 * Build the privacy notice markup.
 * @param {Object} [options]
 * @param {boolean} [options.includeIntro=true]
 * @param {string} [options.headingTag='h3']
 * @returns {string}
 */
export function getPrivacyNoticeHtml(options = {}) {
  const {
    includeIntro = true,
    headingTag = 'h3'
  } = options;

  const safeHeading = /^h[1-6]$/i.test(headingTag) ? headingTag : 'h3';

  const parts = [];

  if (includeIntro) {
    parts.push(
      '<p>CitizenLink is operated by the Digos City Local Government Unit (LGU). ' +
      'We respect your privacy and process personal data in accordance with the Data Privacy Act of 2012 and its implementing rules.</p>'
    );
    parts.push(
      '<p>This Privacy Notice describes how we handle your information when you create an account, file complaints, or interact with the platform.</p>'
    );
  }

  PRIVACY_SECTIONS.forEach((section) => {
    parts.push(`<${safeHeading} class="privacy-heading">${section.title}</${safeHeading}>`);
    if (Array.isArray(section.body) && section.body.length > 0) {
      parts.push('<ul class="privacy-list">');
      section.body.forEach((item) => {
        parts.push(`<li>${item}</li>`);
      });
      parts.push('</ul>');
    }
    if (section.note) {
      parts.push(`<p class="privacy-note"><strong>Note:</strong> ${section.note}</p>`);
    }
  });

  parts.push(`<p class="privacy-updated">Last updated: ${  new Date().toISOString().split('T')[0]  }</p>`);

  return parts.join('');
}

/**
 * Render the privacy notice into a target element.
 * @param {Element|string|null} target
 * @param {Object} [options]
 */
export function renderPrivacyNotice(target, options = {}) {
  if (!target) return;
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;
  element.innerHTML = getPrivacyNoticeHtml(options);
}

export { PRIVACY_SECTIONS };

