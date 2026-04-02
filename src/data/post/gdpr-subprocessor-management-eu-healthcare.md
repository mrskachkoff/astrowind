---
publishDate: 2026-03-03T00:00:00Z
updateDate: 2026-04-02T00:00:00Z
title: 'Subprocessor Review and Vendor Risk Management in EU Healthcare Organizations: A Practical Guide'
excerpt: Healthcare organizations in the EU must track every vendor that touches patient data — including subprocessors. This guide covers the complete workflow for identifying, assessing, and managing third-party data processors under GDPR.
image: ~/assets/images/gdpr-subprocessor-cover.jpg
category: GDPR & Compliance
tags:
  - gdpr
  - healthcare
  - compliance
  - subprocessors
  - vendor risk management
  - data processing agreements
  - international data transfers
  - eu adequacy decisions
  - data privacy framework
  - dpo
  - article 28
  - third party processors
lang: en
metadata:
  title: 'GDPR Subprocessor Management for EU Healthcare | Guide'
  description: 'How EU healthcare organizations track and manage GDPR subprocessors — covering DPAs, adequacy decisions, DPF verification, and a 9-step VRM workflow.'
  robots:
    index: true
    follow: true
  openGraph:
    type: article
    images:
      - url: ~/assets/images/gdpr-subprocessor-cover.jpg
        width: 1200
        height: 630
  twitter:
    cardType: summary_large_image
---

> **Key Takeaways**
> - Subprocessors under GDPR Article 28 require a Data Processing Agreement — GDPR liability extends to the full subprocessor chain, not just your direct vendors.
> - U.S. vendors need active DPF self-certification verification at dataprivacyframework.gov — the U.S. adequacy decision is not a blanket authorization for all American companies.
> - Unknown data processing locations are a GDPR violation and must not proceed without documented safeguards.
> - Ongoing monitoring, not one-time review, is required by GDPR accountability standards.
> - A Transfer Impact Assessment is required for non-adequate third countries alongside Standard Contractual Clauses.

Healthcare organizations in the European Union operate under some of the strictest data protection laws in the world. When handling patient data — especially health data classified as "special category data" under GDPR Article 9 — the responsibility does not stop with the primary vendor. It extends to subprocessors and even further down the supply chain. If you don't know who ultimately touches your patient data, you don't control your risk.

---

## What Is a Subprocessor?

A subprocessor is a third party engaged by a data processor to process personal data on behalf of a controller. While the term is not explicitly defined in the GDPR, it is widely used across privacy and security frameworks — including GDPR, CCPA, SOC 2, and ISO 27001 — to describe third parties that process data on behalf of a data processor.

In simple terms: the health organization is usually the data controller. A vendor (for example, a cloud EHR provider) is the processor. If that vendor uses another company — a hosting provider, an analytics service, a support contractor — that company becomes the subprocessor.

**Practical example:** A hospital contracts an EHR SaaS provider. That EHR provider uses AWS for hosting. AWS is the subprocessor. The subprocessor processes personal data indirectly but is still part of the compliance chain.

Not every vendor is a subprocessor. A vendor is only classified as a subprocessor if they process personal data on behalf of your organization. A company supplying office furniture or facility cleaning services does not process personal data and falls outside the scope entirely.

Common examples of subprocessors in healthcare include:

- Cloud service providers (AWS, Google Cloud, Azure)
- Payment processors (Stripe, Adyen)
- Identity management platforms (Okta, Auth0)
- CRM systems (Salesforce, HubSpot)
- Email delivery solutions (SendGrid, Mailchimp)
- Finance management platforms (NetSuite, Sage)

---

## Why Do We Need to Track Subprocessors?

![Legal documentation and compliance accountability for EU healthcare data protection](~/assets/images/subprocessor-vendor-workflow.jpg)

Tracking subprocessors is not bureaucracy. It is risk control, and in healthcare, the stakes are exceptionally high. Health data is sensitive personal data. Data breaches may result in severe fines. Patient trust is easily damaged. Third-party vendors have been responsible for a significant share of healthcare data breaches, with incidents potentially costing millions per event.

**Regulatory Compliance.** Under GDPR Article 28, controllers must ensure processors provide sufficient guarantees, processors must obtain authorization before engaging subprocessors, and liability can flow back up the chain. Organizations are required to inform data subjects about any subprocessors that handle their personal data. Similarly, SOC 2 controls CC3.1, CC3.2, CC3.3, and CC9.2, along with ISO 27001 Clauses A.15.1.1 and A.15.2.1, mandate clear documentation of data flows and third-party data handling.

**Data Security and Risk Management.** Knowing who your subprocessors are helps you evaluate their security measures, reduces the risk of data breaches or compliance issues, and enables proactive risk assessments. Without this visibility, a breach at a subprocessor could expose thousands of patient records before your organization becomes aware.

**Data Flow Transparency.** Understanding where data is processed, stored, and transmitted helps organizations assess cross-border data transfer risks — particularly when data moves to countries with different data protection laws.

**Contractual Accountability.** Under GDPR Article 28(3), a Data Processing Agreement is a legally binding requirement that outlines the subprocessor's obligations regarding data handling, breach notifications, and compliance. Every subprocessor that touches personal data must be covered by a DPA.

**Ongoing Monitoring.** Risks evolve. Continuous monitoring helps organizations stay aware of changes in vendor risk after a security review is complete, surfacing alerts and findings over time so teams can assess impact and decide when follow-up is needed. A vendor compliant at onboarding may have changed its practices, infrastructure, or corporate ownership since then.

For a full overview of baseline GDPR obligations applicable to your organization, see our guide to [GDPR baseline obligations for healthcare providers](/gdpr-compliance-small-healthcare-providers-guide).

---

## Vendor Risk Management in EU Healthcare

Vendor Risk Management (VRM) is the structured process of assessing, monitoring, and managing risks associated with third-party service providers. In healthcare organizations, this must include data protection compliance, security certifications (ISO 27001, SOC 2), data residency analysis, subprocessor transparency, and ongoing monitoring.

The review cannot be a one-time checkbox exercise. It must be continuous. Governance, Risk, and Compliance (GRC) platforms help manage vendor inventory — from adding and discovering vendors to keeping each vendor profile up to date, running security reviews, and monitoring risk over time.

Just as HIPAA requires Business Associate Agreements, GDPR requires clear processor agreements. Organizations should monitor vendor compliance by requiring audit rights or certifications, and ensure the same obligations cover subprocessors. Any entity handling patient data on the organization's behalf must be held to GDPR standards.

For a detailed analysis of Article 28 obligations in the context of AI-driven workflows, see our article on [Article 28 subprocessor obligations in AI agent tool chains](/ai-agents-healthcare-gdpr-risks).

---

## Where Can EU Personal Data Be Legally Transferred?

The GDPR strictly regulates the transfer of personal data from the EU to countries outside the European Economic Area. Under Article 45, the European Commission can determine that a third country provides an adequate level of data protection — meaning it offers safeguards essentially equivalent to those guaranteed within the EU. When an adequacy decision exists, personal data can flow freely to that country without additional safeguards such as Standard Contractual Clauses or Binding Corporate Rules.

**As of early 2026, the European Commission has adopted adequacy decisions for the following countries and territories:**

- Andorra
- Argentina
- Brazil *(mutual adequacy adopted in 2026)*
- Canada *(for entities covered by PIPEDA)*
- Faroe Islands
- Guernsey
- Isle of Man
- Israel
- Japan
- Jersey
- New Zealand
- Republic of Korea (South Korea)
- Switzerland
- United Kingdom *(renewed in December 2025)*
- United States *(under the EU-U.S. Data Privacy Framework, adopted July 2023)*
- Uruguay
- European Patent Organisation *(July 2025 — the first international organization to receive adequacy)*

> **Important:** Adequacy decisions are not permanent. The European Commission continuously monitors data protection practices in third countries and can revoke or suspend a decision if adequate protection is no longer ensured. The U.S. adequacy decision was reviewed in October 2024 and maintained. Healthcare organizations should verify the status of applicable adequacy decisions before completing a vendor risk assessment.

For healthcare organizations, this list is the starting reference point. If a subprocessor stores or processes data in one of these countries, the transfer mechanism is straightforward. If the subprocessor operates in a country not on this list, additional safeguards are required — Standard Contractual Clauses, Binding Corporate Rules, or a valid derogation under Article 49.

**Key Reference:** [European Commission adequacy decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en)

---

## The United States: The Data Privacy Framework and Self-Certification Registry

The United States does not have blanket adequacy status. Unlike most adequate countries where national legislation provides blanket protection, the U.S. adequacy decision applies **only to companies that have self-certified** under the EU-U.S. Data Privacy Framework (DPF), adopted by the European Commission on July 10, 2023.

To join the Data Privacy Framework, a company must self-certify to the U.S. Department of Commerce that it complies with the DPF Principles. Participating companies must renew their certification annually, and a failure to comply may violate Section 5 of the FTC Act.

**Who can participate:** To be eligible for certification, an organization must be subject to the investigatory and enforcement powers of the Federal Trade Commission or the U.S. Department of Transportation. Certain sectors — including banking, insurance, and telecommunications — are currently unable to participate in the DPF program.

**Verification is mandatory.** Before transferring personal data to a U.S. company claiming DPF certification, you must verify that the company holds an active self-certification and that this certification covers the data in question. Certifications must be renewed annually, and the public DPF List also shows organizations that have been removed along with the reasons for removal. Blindly assuming compliance is not acceptable.

**Practical example — Anthropic:** Not all major U.S. technology providers are listed on the Data Privacy Framework. Anthropic — the company behind Claude AI — does not appear to hold an active DPF self-certification. This does not mean EU healthcare organizations cannot use their services, but it does mean the U.S. adequacy decision does not apply to data transfers to Anthropic. Instead, organizations must rely on alternative transfer mechanisms. Anthropic offers a Data Processing Addendum that incorporates Standard Contractual Clauses (Modules 1, 2, and 3) to cover international data transfers. Their DPA also includes sub-processor management provisions requiring Anthropic to provide reasonable notice before appointing additional sub-processors, with a ten-day window for customers to raise objections.

This is a practical example of why checking the DPF List for each specific U.S. vendor matters — the adequacy decision is not a blanket authorization for all American companies, and healthcare organizations must verify the transfer mechanism on a vendor-by-vendor basis.

**Key References:**
- [Data Privacy Framework List](https://www.dataprivacyframework.gov/list)
- [EU-U.S. Data Privacy Framework adequacy decision](https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj)

---

## What to Do If a Subprocessor Is in a Third Country or Data Location Is Unknown

If a vendor cannot clearly disclose where data is stored, which subprocessors are involved, or whether cross-border transfers occur, this is a red flag. Unknown data location can violate GDPR transparency obligations, undermine patient rights, and increase breach notification complexity.

**Step 1 — Request Full Transparency.** Ask the subprocessor to disclose all data processing locations, including primary data centers, backup and disaster recovery sites, and any further subprocessors they engage. If they cannot or will not disclose, treat this as a significant red flag.

**Step 2 — Check Against the Adequacy List.** Compare disclosed locations against the European Commission's list of adequate countries. If all processing occurs within the EEA or in an adequate country, the transfer is permissible under Article 45.

**Step 3 — For Non-Adequate Countries, Implement Safeguards.** If a subprocessor processes data in a country without an adequacy decision — for example India, China, or many nations in Africa and Southeast Asia — you must implement appropriate safeguards under GDPR Article 46. The most common mechanism is Standard Contractual Clauses. A Transfer Impact Assessment is also required to evaluate whether the laws of the destination country could undermine the protections the SCCs offer.

**Step 4 — For Unknown Locations, Do Not Proceed.** If a subprocessor cannot confirm where data is processed, do not transfer personal data to that vendor. The GDPR places the burden of accountability on the data controller. Processing EU personal data in an unknown jurisdiction is indefensible in the event of a regulatory inquiry or breach.

**Step 5 — Include Contractual Restrictions.** Your DPA should include geographic restrictions specifying where the subprocessor is authorized to process data, and require prior written consent before any change in processing location. This is especially important for healthcare data classified as special category data under GDPR Article 9.

**Step 6 — Conduct a DPIA.** For high-risk transfers involving health data crossing borders, a Data Protection Impact Assessment under GDPR Article 35 is recommended or may be legally required.

For organizations considering an on-premise architecture as a response to transfer risk, see our analysis of the [architectural approach to data sovereignty for unknown transfer risks](/why-healthcare-needs-on-premise-ai).

---

## Subprocessor Review Workflow for Healthcare Organizations

Managing subprocessors in a healthcare organization under the GDPR is a continuous, structured process. Below is the recommended workflow.

**Step 1 — Vendor Onboarding.** Identify if the vendor acts as a processor. Request a subprocessor disclosure list. Obtain a Data Processing Agreement. Build and maintain a comprehensive register of all vendors that process personal data on your behalf, and classify each as a subprocessor or non-subprocessor.

**Step 2 — Subprocessor Identification.** Map all subprocessors. Classify each by data type processed, data sensitivity, and geographic location.

**Step 3 — Jurisdiction Assessment.** Check if the country has an EU adequacy decision. If the subprocessor is U.S.-based, verify active DPF certification at [dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list). If the country is non-adequate, require Standard Contractual Clauses plus a Transfer Impact Assessment.

**Step 4 — Security and Compliance Review.** Evaluate certifications (ISO 27001, SOC 2). Review incident response posture. Assess encryption and access controls. Check breach history. Ensure the subprocessor's security practices align with your organization's policies and standards.

**Step 5 — Risk Rating.** Assign a risk level: Low, Medium, High, or Critical. Base this on the volume and sensitivity of data processed, data processing locations, impact of a potential failure or breach, and the vendor's security posture. Document residual risk.

**Step 6 — Approval or Rejection.** Approve with safeguards in place. Approve conditionally pending remediation of identified gaps. Or reject the vendor entirely. Document the decision and rationale in your vendor risk register.

**Step 7 — Contractual Framework.** Execute a DPA compliant with GDPR Article 28(3), covering: the nature and purpose of processing; categories of data and data subjects; duration of processing; breach notification obligations; geographic restrictions on data processing; audit rights; and subprocessor change notification requirements.

![Healthcare organization signing a GDPR-compliant Data Processing Agreement with a vendor](~/assets/images/gdpr-dpa-signing.jpg)

**Step 8 — Ongoing Monitoring.** Conduct periodic reviews — at least annually for high-risk vendors, and triggered by material changes such as acquisitions, infrastructure changes, or security incidents. Monitor the DPF List for changes in U.S. vendor certification status. Track changes to the EU adequacy decisions list. Monitor for new subprocessors added by existing vendors. Use continuous monitoring tools to surface alerts when a vendor's risk profile changes.

**Step 9 — Offboarding.** When a subprocessor relationship ends, verify secure deletion or return of all personal data. Revoke all access credentials and system permissions. Obtain written confirmation of data destruction. Update your subprocessor register accordingly.

---

## Key Questions

**What is a subprocessor under GDPR Article 28?**

A subprocessor is a third party engaged by a data processor to carry out processing activities on behalf of the data controller. Under GDPR Article 28, processors must not engage subprocessors without prior authorization from the controller, and any subprocessor relationship must be governed by a contract that imposes the same data protection obligations as those in the main processing agreement. The data controller remains liable for the subprocessor's compliance.

**Do EU healthcare organizations need to audit their subprocessors?**

Yes. GDPR Article 28 requires controllers to ensure their processors provide sufficient guarantees to implement appropriate technical and organizational measures. This implies an obligation to assess and verify subprocessor compliance — not just at onboarding, but on an ongoing basis. ISO 27001 Clause A.15.2.1 and SOC 2 control CC9.2 both reinforce the need for continuous supplier review, not just initial contracting.

**How do I verify US Data Privacy Framework (DPF) self-certification?**

Go to [dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list) and search for the specific company by name. The list shows active certifications and their renewal dates, as well as companies that have previously participated but have since been removed. Verify that the certification covers the categories of personal data you intend to transfer — some certifications cover human resources data only. Annual re-verification is best practice, as certifications must be renewed each year.

**What happens if a subprocessor is in an unknown jurisdiction?**

If a subprocessor cannot or will not disclose where personal data is processed, the data controller should not transfer data to that vendor. GDPR places the burden of accountability on the controller, and processing in an unknown jurisdiction violates GDPR transparency principles under Articles 5 and 13–14. In the event of a breach or regulatory investigation, the inability to identify where data was processed will be treated as an aggravating factor by supervisory authorities.

**How often should healthcare organizations review their subprocessors?**

At minimum, annually — but in practice, reviews should also be triggered by material events: acquisitions or changes in vendor ownership, infrastructure migrations, new subprocessors added to the chain, changes to adequacy decisions or DPF certification status, and any security incidents. High-risk vendors processing special category health data should be reviewed more frequently than low-risk suppliers.

---

## Practical Reality in Healthcare

Many healthcare organizations do not maintain updated subprocessor lists. They do not verify DPF certification for U.S. vendors. They do not conduct Transfer Impact Assessments properly. They assume large cloud providers are automatically compliant. This is risky thinking. Regulators expect documented diligence.

A strong review process should:

- Maintain a documented subprocessor inventory
- Verify EU adequacy decisions for each jurisdiction
- Confirm U.S. DPF registration where applicable
- Require Standard Contractual Clauses and Transfer Impact Assessments for third-country transfers
- Enforce transparency and contractual control over data locations
- Include periodic reassessment — not just onboarding checks

If you cannot explain who processes your patient data, where it is stored, and under what legal basis it is transferred, then you do not control your compliance posture. In healthcare, that is unacceptable.

Start with our [free Automation Roadmap](/automation-roadmap) — we assess your clinic's data handling, identify safe automation opportunities, and deliver a clear compliance roadmap, completely free.

---

## References

1. [EU Data Protection Adequacy Decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en) — European Commission
2. [EU-U.S. Data Privacy Framework List](https://www.dataprivacyframework.gov/list) — U.S. Department of Commerce
3. [EU-U.S. DPF Adequacy Decision](https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj) — EUR-Lex
4. [What Is a Subprocessor?](https://help.drata.com/en/articles/9792194-what-is-a-subprocessor) — Drata
5. [Third Party Risk Management Overview](https://help.vanta.com/en/articles/11345557-third-party-risk-management-overview) — Vanta
6. GDPR Articles 9, 28, 35, 45, and 46 — Regulation (EU) 2016/679

---

*This article is for informational purposes only and does not constitute legal advice. Healthcare organizations should consult qualified legal counsel for compliance decisions specific to their circumstances.*
