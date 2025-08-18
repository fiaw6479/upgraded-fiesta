import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight, Check, Star, Users, TrendingUp, Shield, 
  Smartphone, BarChart3, Gift, Crown, Zap, ChefHat,
  Globe, Clock, Award, Target, Sparkles, Play,
  CheckCircle, ArrowDown, Menu, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [0.95, 1]);
  const heroY = useTransform(scrollY, [0, 300], [0, -50]);

  const plans = [
    {
      name: 'Free Trial',
      price: '$0',
      period: '1 month',
      description: 'Perfect for testing our platform',
      features: [
        'Up to 100 customers',
        'Basic loyalty program',
        'QR code system',
        'Basic analytics',
        'Email support'
      ],
      cta: 'Start Free Trial',
      popular: false,
      planId: 'trial'
    },
    {
      name: 'Monthly',
      price: '$2.99',
      period: 'per month',
      description: 'Flexible monthly billing',
      features: [
        'Unlimited customers',
        'Advanced loyalty features',
        'Multi-branch support',
        'Advanced analytics',
        'Priority support',
        'Custom rewards',
        'Staff management'
      ],
      cta: 'Get Started',
      popular: true,
      planId: 'monthly'
    },
    {
      name: '6 Months',
      price: '$9.99',
      period: 'one-time',
      description: 'Save 44% with 6-month plan',
      features: [
        'Everything in Monthly',
        'Advanced ROI analytics',
        'Custom branding',
        'API access',
        'Dedicated support',
        'Training sessions'
      ],
      cta: 'Choose 6 Months',
      popular: false,
      planId: 'semiannual'
    },
    {
      name: '1 Year',
      price: '$19.99',
      period: 'one-time',
      description: 'Best value - Save 67%',
      features: [
        'Everything in 6 Months',
        'White-label solution',
        'Custom integrations',
        'Account manager',
        'Advanced reporting',
        'Priority feature requests'
      ],
      cta: 'Choose Annual',
      popular: false,
      planId: 'annual'
    }
  ];

  const testimonials = [
    {
      name: 'Ahmed Al-Rashid',
      role: 'Owner, Spice Route Restaurant',
      content: 'Voya transformed our customer retention. We saw a 40% increase in repeat customers within 3 months.',
      rating: 5,
      avatar: 'AR'
    },
    {
      name: 'Sarah Johnson',
      role: 'Manager, Café Delights',
      content: 'The staff interface is incredibly intuitive. Our team was up and running in minutes.',
      rating: 5,
      avatar: 'SJ'
    },
    {
      name: 'Mohammed Hassan',
      role: 'Owner, Golden Palace',
      content: 'The analytics helped us understand our customers better and increase our average order value by 25%.',
      rating: 5,
      avatar: 'MH'
    }
  ];

  const features = [
    {
      icon: Users,
      title: 'Customer Loyalty Program',
      description: 'Automated point system with tier-based rewards that keep customers coming back.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Smartphone,
      title: 'QR Code Integration',
      description: 'Seamless point earning through QR codes - no apps required for customers.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Real-time insights into customer behavior, ROI, and loyalty program performance.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Crown,
      title: 'Multi-Branch Support',
      description: 'Manage multiple locations with unified customer data and branch-specific insights.',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with 99.9% uptime guarantee and data protection.',
      color: 'from-red-500 to-red-600'
    },
    {
      icon: Zap,
      title: 'Easy Setup',
      description: 'Get started in minutes with our intuitive setup wizard and pre-built templates.',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif]">
      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200"
        style={{ opacity: headerOpacity }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/image.png" alt="VOYA" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold font-['Space_Grotesk'] bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                VOYA
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="text-gray-600 hover:text-gray-900 transition-colors">
                Reviews
              </button>
              <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
                Sign In
              </Link>
              <button 
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-6 py-2 rounded-xl hover:shadow-lg transition-all duration-200"
              >
                Start Free Trial
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div 
            className="md:hidden bg-white border-t border-gray-200"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 py-4 space-y-4">
              <button onClick={() => scrollToSection('features')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                Features
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                Pricing
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                Reviews
              </button>
              <Link to="/login" className="block w-full text-left text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
              <button 
                onClick={() => navigate('/signup')}
                className="w-full bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-200"
              >
                Start Free Trial
              </button>
            </div>
          </motion.div>
        )}
      </motion.header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            style={{ y: heroY }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              className="mb-8"
            >
              <img src="/image.png" alt="VOYA" className="w-24 h-24 mx-auto mb-6" />
              <h1 className="text-5xl md:text-7xl font-bold font-['Space_Grotesk'] mb-6 leading-tight">
                <span className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                  Transform
                </span>
                <br />
                <span className="text-gray-900">Your Restaurant's</span>
                <br />
                <span className="text-gray-900">Customer Loyalty</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                The complete loyalty platform that increases customer retention by 40% and boosts revenue through intelligent rewards and analytics.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <button 
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => scrollToSection('demo')}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Play className="h-5 w-5" />
                Watch Demo
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-wrap justify-center items-center gap-8 text-gray-500"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span>Enterprise Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>500+ Restaurants</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-['Space_Grotesk'] text-gray-900 mb-6">
              Everything You Need to Build
              <span className="block bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                Customer Loyalty
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From QR-based point collection to advanced analytics, Voya provides all the tools you need to create a thriving loyalty program.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 font-['Space_Grotesk']">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-['Space_Grotesk'] text-gray-900 mb-6">
              Simple, Transparent
              <span className="block bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that fits your restaurant's needs. Start with our free trial and upgrade anytime.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative bg-white rounded-2xl p-8 border-2 transition-all duration-300 hover:shadow-xl ${
                  plan.popular 
                    ? 'border-[#E6A85C] shadow-lg scale-105' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 font-['Space_Grotesk']">
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/signup', { state: { selectedPlan: plan.planId } })}
                  className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white hover:shadow-lg'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold font-['Space_Grotesk'] text-gray-900 mb-6">
              Loved by Restaurant
              <span className="block bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] bg-clip-text text-transparent">
                Owners
              </span>
            </h2>
          </motion.div>

          <div className="relative">
            <motion.div
              key={activeTestimonial}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-200 text-center"
            >
              <div className="flex justify-center mb-4">
                {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl text-gray-700 mb-6 leading-relaxed">
                "{testimonials[activeTestimonial].content}"
              </blockquote>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center text-white font-bold">
                  {testimonials[activeTestimonial].avatar}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{testimonials[activeTestimonial].name}</p>
                  <p className="text-gray-600">{testimonials[activeTestimonial].role}</p>
                </div>
              </div>
            </motion.div>

            {/* Testimonial Indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === activeTestimonial 
                      ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B]' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold font-['Space_Grotesk'] text-white mb-6">
              Ready to Transform Your Restaurant?
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Join hundreds of restaurants already using Voya to build stronger customer relationships and increase revenue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/signup')}
                className="bg-white text-gray-900 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Start Your Free Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link 
                to="/login"
                className="border-2 border-white/30 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-all duration-300"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <img src="/image.png" alt="VOYA" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold font-['Space_Grotesk']">VOYA</span>
            </div>
            <div className="flex items-center gap-6 text-gray-400">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/support" className="hover:text-white transition-colors">Support</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Voya. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;