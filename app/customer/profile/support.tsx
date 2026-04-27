import React from 'react';
import { SupportView } from '@/components/shared/SupportView';

const FAQS = [
  { q: 'How do I book a cleaner?', a: 'Tap the "+" Book button in the bottom navigation. Choose your service type, specific tasks, and schedule. Your funds will be held in escrow until the job is done.' },
  { q: 'Can I cancel a booking?', a: 'Yes, you can cancel any job that is still in the "OPEN" status. Go to My Jobs, select the request, and tap "Cancel". Your funds will be automatically refunded to your wallet.' },
  { q: 'How does the hiring process work?', a: 'Once you post a job, interested cleaners will apply. You can view their profiles and ratings in the job details. Tap "Approve & Hire" to select your preferred cleaner.' },
  { q: 'Is my money safe?', a: 'Absolutely. We use a secure escrow system. Your payment is only released to the cleaner after you approve the completed work.' },
  { q: 'What if I am not satisfied?', a: 'If you are unhappy with the service, do not approve the job completion. Contact our support immediately via the "Contact Us" button below.' },
];

export default function SupportScreen() {
  return (
    <SupportView 
      faqs={FAQS} 
      sectionTitle="Frequently Asked Questions"
      contactTitle="Still need help?"
      contactButtonText="Contact Us"
    />
  );
}
