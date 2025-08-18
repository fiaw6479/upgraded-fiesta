import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Users } from 'lucide-react';

const PrivacyPage: React.FC = () => {
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
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
              Privacy Policy
            </h1>
            <p className="text-gray-600">
              Last updated: January 2025
            </p>
          </div>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Information We Collect
              </h2>
              <p className="text-gray-700 mb-4">
                We collect information you provide directly to us, such as when you create an account, 
                use our services, or contact us for support.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Account information (name, email, restaurant details)</li>
                <li>Customer data you input into our loyalty system</li>
                <li>Usage data and analytics</li>
                <li>Payment information (processed securely through Stripe)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Provide and maintain our loyalty platform services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices and support messages</li>
                <li>Improve our services and develop new features</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Data Security
              </h2>
              <p className="text-gray-700 mb-4">
                We implement appropriate security measures to protect your personal information against 
                unauthorized access, alteration, disclosure, or destruction.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <Lock className="h-6 w-6 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-blue-900">Encryption</h3>
                  <p className="text-sm text-blue-800">All data encrypted in transit and at rest</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <Shield className="h-6 w-6 text-green-600 mb-2" />
                  <h3 className="font-semibold text-green-900">Secure Infrastructure</h3>
                  <p className="text-sm text-green-800">Hosted on enterprise-grade servers</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <Eye className="h-6 w-6 text-purple-600 mb-2" />
                  <h3 className="font-semibold text-purple-900">Access Control</h3>
                  <p className="text-sm text-purple-800">Strict access controls and monitoring</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Your Rights
              </h2>
              <p className="text-gray-700 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Access and update your personal information</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
                <li>Request data portability</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                Contact Us
              </h2>
              <p className="text-gray-700">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-xl mt-4">
                <p className="text-gray-900 font-medium">Email: privacy@voya.com</p>
                <p className="text-gray-900 font-medium">Address: Dubai, UAE</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;