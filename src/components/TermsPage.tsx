import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, Users, CreditCard } from 'lucide-react';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src="/image.png" alt="VOYA" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold font-['Space_Grotesk'] bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                VOYA
              </span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
              Terms of Service
            </h1>
            <p className="text-gray-600">
              Last updated: January 2025
            </p>
          </div>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Acceptance of Terms
              </h2>
              <p className="text-gray-700 mb-4">
                By accessing and using Voya's loyalty platform services, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Service Description
              </h2>
              <p className="text-gray-700 mb-4">
                Voya provides a comprehensive customer loyalty platform for restaurants, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Customer loyalty program management</li>
                <li>Point-based reward systems</li>
                <li>QR code integration for seamless customer experience</li>
                <li>Analytics and reporting tools</li>
                <li>Multi-branch support and staff management</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Subscription Plans
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <FileText className="h-6 w-6 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-blue-900">Trial Period</h3>
                  <p className="text-sm text-blue-800">30-day free trial with limited features</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <CreditCard className="h-6 w-6 text-green-600 mb-2" />
                  <h3 className="font-semibold text-green-900">Paid Plans</h3>
                  <p className="text-sm text-green-800">Monthly, 6-month, and annual billing options</p>
                </div>
              </div>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Trial: $0 for 1 month (up to 100 customers)</li>
                <li>Monthly: $2.99 per month (unlimited features)</li>
                <li>6 Months: $9.99 one-time (44% savings)</li>
                <li>Annual: $19.99 one-time (67% savings)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Payment Terms
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>All payments are processed securely through Stripe</li>
                <li>Subscriptions automatically renew unless cancelled</li>
                <li>Refunds are available within 30 days of purchase</li>
                <li>Failed payments may result in service suspension</li>
                <li>Price changes will be communicated 30 days in advance</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                User Responsibilities
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Maintain the security of your account credentials</li>
                <li>Use the service in compliance with applicable laws</li>
                <li>Provide accurate and up-to-date information</li>
                <li>Respect intellectual property rights</li>
                <li>Not attempt to reverse engineer or hack the platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Limitation of Liability
              </h2>
              <p className="text-gray-700 mb-4">
                Voya shall not be liable for any indirect, incidental, special, consequential, or punitive damages, 
                including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Contact Information
              </h2>
              <p className="text-gray-700">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-xl mt-4">
                <p className="text-gray-900 font-medium">Email: legal@voya.com</p>
                <p className="text-gray-900 font-medium">Address: Dubai, UAE</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;