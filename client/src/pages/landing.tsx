import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  CheckCircle, 
  Users, 
  Target, 
  BarChart3, 
  Zap, 
  Shield, 
  Clock,
  Star,
  Rocket,
  Heart,
  TrendingUp,
  Globe,
  Sparkles
} from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");

  const handleGetStarted = () => {
    setLocation("/register");
  };

  const handleLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Kanbax
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={handleLogin}>
                Anmelden
              </Button>
              <Button onClick={handleGetStarted} className="bg-gradient-to-r from-blue-600 to-purple-600">
                Kostenlos starten
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2 bg-white/50 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
              Die Zukunft des Projektmanagements
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
              Verwandeln Sie Chaos
              <br />
              in <span className="relative">
                Erfolg
                <div className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-yellow-300 to-orange-300 opacity-30 rounded-full"></div>
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
              Kanbax bringt Ihr Team zusammen, macht komplexe Projekte übersichtlich und 
              verwandelt Stress in Produktivität. <strong>Endlich Projektmanagement, das Spaß macht.</strong>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button 
                onClick={handleGetStarted}
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-lg px-8 py-4 h-auto"
              >
                <Heart className="h-5 w-5 mr-2" />
                Kostenlos ausprobieren
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <p className="text-sm text-gray-500">
                ✨ Keine Kreditkarte erforderlich • 30 Tage kostenlos
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">DSGVO-konform</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Made in Germany</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium">4.9/5 ⭐ Bewertung</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-200 rounded-full opacity-20 animate-pulse delay-1000"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Warum Teams Kanbax <span className="text-red-500">❤️</span> lieben
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Mehr als nur ein Tool – Kanbax ist der Schlüssel zu besserer Zusammenarbeit, 
              klareren Zielen und messbarem Erfolg.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Teamwork, das funktioniert</CardTitle>
                <CardDescription className="text-base">
                  Schluss mit endlosen E-Mails und verpassten Deadlines. 
                  Kanbax bringt alle auf denselben Stand.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Echtzeit-Kollaboration
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Klare Aufgabenverteilung
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Automatische Updates
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Ziele, die erreicht werden</CardTitle>
                <CardDescription className="text-base">
                  Mit OKRs verwandeln Sie große Träume in konkrete, 
                  messbare Erfolge – Schritt für Schritt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Smarte Zielsetzung
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Fortschritts-Tracking
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Motivierende Dashboards
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Insights, die bewegen</CardTitle>
                <CardDescription className="text-base">
                  Datengetriebene Entscheidungen treffen war noch nie so einfach. 
                  Sehen Sie, was wirklich zählt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Aussagekräftige Reports
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Produktivitäts-Analyse
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Trend-Erkennung
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-orange-50 to-red-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Geschwindigkeit & Einfachheit</CardTitle>
                <CardDescription className="text-base">
                  Keine wochenlange Einarbeitung. Starten Sie in Minuten 
                  und spüren Sie sofort den Unterschied.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Intuitive Bedienung
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Schnelle Einrichtung
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Sofortige Ergebnisse
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-teal-50 to-cyan-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Sicherheit & Vertrauen</CardTitle>
                <CardDescription className="text-base">
                  Ihre Daten sind bei uns sicher. DSGVO-konform, 
                  verschlüsselt und in Deutschland gehostet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Ende-zu-Ende Verschlüsselung
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Deutsche Server
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    DSGVO-Compliance
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-violet-50 to-purple-100 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">Zeit ist kostbar</CardTitle>
                <CardDescription className="text-base">
                  Sparen Sie bis zu 40% Ihrer Projektzeit durch 
                  intelligente Automatisierung und optimierte Workflows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Automatische Workflows
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Smart Templates
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Zeitersparnis messbar
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">
              Über <span className="text-blue-600">10.000+ Teams</span> vertrauen bereits auf Kanbax
            </h2>
            <p className="text-xl text-gray-600">
              Von Startups bis zu Fortune 500 Unternehmen – Kanbax skaliert mit Ihren Bedürfnissen
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "Kanbax hat unser Projektchaos in eine gut geölte Maschine verwandelt. 
                  Wir sind 60% produktiver geworden!"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">SA</span>
                  </div>
                  <div>
                    <p className="font-semibold">Sarah Anderson</p>
                    <p className="text-sm text-gray-500">Projektleiterin, TechStart GmbH</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "Endlich ein Tool, das mein Team gerne benutzt! Die Bedienung ist so intuitiv, 
                  dass sich alle sofort zurechtgefunden haben."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">MK</span>
                  </div>
                  <div>
                    <p className="font-semibold">Michael König</p>
                    <p className="text-sm text-gray-500">CTO, Innovation Labs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "Mit Kanbax haben wir unsere Projektziele nicht nur erreicht, sondern übertroffen. 
                  Das motiviert das ganze Team!"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">LM</span>
                  </div>
                  <div>
                    <p className="font-semibold">Lisa Müller</p>
                    <p className="text-sm text-gray-500">Geschäftsführerin, Creative Agency</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            Bereit für den Wandel? 🚀
          </h2>
          <p className="text-xl mb-12 opacity-90">
            Schließen Sie sich tausenden von Teams an, die bereits erfolgreich mit Kanbax arbeiten. 
            Starten Sie noch heute – kostenlos und ohne Risiko.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              onClick={handleGetStarted}
              size="lg" 
              className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4 h-auto font-semibold"
            >
              <Rocket className="h-5 w-5 mr-2" />
              Jetzt kostenlos starten
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            
            <div className="text-center">
              <p className="text-sm opacity-80">
                ✨ 30 Tage kostenlos • Keine Kreditkarte nötig
              </p>
              <p className="text-sm opacity-80">
                💝 Kündigung jederzeit möglich
              </p>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap justify-center items-center gap-8 opacity-70">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">40% weniger Projektzeit</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="text-sm">98% Teamzufriedenheit</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <span className="text-sm">3x mehr erreichte Ziele</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Kanbax</span>
            </div>
            <p className="text-gray-400 mb-8">
              Projektmanagement, das Teams begeistert und Erfolge möglich macht.
            </p>
            <div className="flex justify-center space-x-8 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Datenschutz</a>
              <a href="#" className="hover:text-white transition-colors">Impressum</a>
              <a href="#" className="hover:text-white transition-colors">AGB</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-800">
              <p className="text-gray-500 text-sm">
                © 2024 Kanbax. Made with ❤️ in Germany. Alle Rechte vorbehalten.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}