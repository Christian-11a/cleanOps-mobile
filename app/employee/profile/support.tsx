import React from 'react';
import { SupportView } from '@/components/shared/SupportView';

const FAQS = [
  { q: 'How do I get paid?', a: 'Once a job is approved by the customer, your earnings are added to your wallet. You can withdraw them anytime from the Wallet tab.' },
  { q: 'How do I apply for jobs?', a: 'Go to the Feed tab to see available jobs in your area. Tap on a job to see details and click "Apply for Job". If the customer approves, the job will appear in your "Active" list.' },
  { q: 'What is the platform fee?', a: 'CleanOps charges a flat 10% platform fee on every job. This covers insurance, payment processing, and app maintenance. You keep 90% of your earnings.' },
  { q: 'Can I cancel a job?', a: 'If you need to cancel a job after being hired, please contact support or the customer immediately. Frequent cancellations may affect your rating.' },
  { q: 'How do I improve my rating?', a: 'Ensure you arrive on time, follow the customer\'s specific instructions, and maintain a high standard of cleaning. Positive reviews lead to more job opportunities.' },
];

export default function EmployeeSupportScreen() {
  return (
    <SupportView 
      faqs={FAQS} 
      sectionTitle="Employee FAQs"
      contactTitle="Need urgent help?"
      contactButtonText="Contact Support"
    />
  );
}
