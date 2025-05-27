import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Building, 
  Users, 
  Crown, 
  Target, 
  CheckSquare, 
  Calendar,
  CreditCard,
  Shield,
  HelpCircle
} from "lucide-react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "unternehmen" | "benutzer" | "features" | "abonnements" | "okr" | "tasks" | "allgemein";
  tags: string[];
}

const faqData: FAQItem[] = [
  // Unternehmen & Organisation
  {
    id: "company-create",
    question: "Wie erstelle ich ein Unternehmen?",
    answer: "Um ein Unternehmen zu erstellen, benötigen Sie mindestens ein Basic-Abonnement. Gehen Sie zu Ihrem Profil > Unternehmen und klicken Sie auf 'Unternehmen erstellen'. Nach der Erstellung werden Sie automatisch zum Unternehmensadministrator und können Mitarbeiter einladen.",
    category: "unternehmen",
    tags: ["erstellen", "administrator", "basic", "abonnement"]
  },
  {
    id: "company-join",
    question: "Wie trete ich einem Unternehmen bei?",
    answer: "Sie können einem Unternehmen mit einem Einladungscode beitreten. Dieser wird vom Unternehmensadministrator generiert. Gehen Sie zu Profil > Unternehmen > 'Unternehmen beitreten' und geben Sie den 8-stelligen Code ein.",
    category: "unternehmen",
    tags: ["beitreten", "einladungscode", "mitarbeiter"]
  },
  {
    id: "company-admin-rights",
    question: "Was kann ein Unternehmensadministrator?",
    answer: "Unternehmensadministratoren können: Mitarbeiter einladen und verwalten, Unternehmensinformationen bearbeiten, Teams erstellen und verwalten, Projekte und Boards für das Unternehmen anlegen, Abonnements für das gesamte Unternehmen verwalten.",
    category: "unternehmen",
    tags: ["administrator", "rechte", "verwaltung", "teams"]
  },
  {
    id: "company-vs-personal",
    question: "Was ist der Unterschied zwischen Unternehmens- und persönlichen Inhalten?",
    answer: "Persönliche Inhalte (Boards, Tasks, OKRs) sind nur für Sie sichtbar. Unternehmensinhalte sind für alle Mitarbeiter des Unternehmens zugänglich, basierend auf Zuweisungen und Teamzugehörigkeiten. Als Unternehmensadministrator haben Sie Zugriff auf alle Unternehmensinhalte.",
    category: "unternehmen",
    tags: ["persönlich", "unternehmen", "sichtbarkeit", "zugriff"]
  },

  // Benutzerrollen & Berechtigungen
  {
    id: "user-roles",
    question: "Welche Benutzerrollen gibt es?",
    answer: "Es gibt mehrere Rollen: Hyper-Admin (Plattform-Administrator), Unternehmensadministrator (verwaltet ein Unternehmen), Teamleiter (verwaltet Teams), und normale Benutzer (Teammitglieder). Jede Rolle hat spezifische Berechtigungen.",
    category: "benutzer",
    tags: ["rollen", "berechtigungen", "administrator", "teamleiter"]
  },
  {
    id: "user-activation",
    question: "Warum muss mein Account aktiviert werden?",
    answer: "Neue Benutzer, die einem Unternehmen mit einem Einladungscode beitreten, müssen vom Unternehmensadministrator aktiviert werden. Dies stellt sicher, dass nur autorisierte Personen Zugang erhalten. Bis zur Aktivierung haben Sie eingeschränkten Zugriff.",
    category: "benutzer",
    tags: ["aktivierung", "einladung", "autorisierung", "zugriff"]
  },
  {
    id: "user-permissions",
    question: "Wer kann meine Inhalte sehen?",
    answer: "Ihre Inhalte sind nur für Sie, direkt zugewiesene Benutzer und Teammitglieder sichtbar. Unternehmensadministratoren haben NICHT automatisch Zugriff auf alle Inhalte - sie sehen nur das, was ihnen explizit zugewiesen wurde oder wo sie Teammitglied sind.",
    category: "benutzer",
    tags: ["sichtbarkeit", "zugriff", "teams", "zuweisung"]
  },

  // Abonnements & Preise
  {
    id: "subscription-tiers",
    question: "Welche Abonnement-Stufen gibt es?",
    answer: "Free (kostenlos, begrenzte Features), Freelancer (€12/Monat), Organisation (€29/Monat), Enterprise (€59/Monat), und Kanbax (€99/Monat). Jede Stufe bietet mehr Features und höhere Limits. Jahresabonnements erhalten 10% Rabatt.",
    category: "abonnements",
    tags: ["preise", "stufen", "features", "jahresrabatt"]
  },
  {
    id: "subscription-limits",
    question: "Welche Limits gelten für mein Abonnement?",
    answer: "Jedes Abonnement hat Limits für: Anzahl Boards, Tasks pro Board, Projekte, OKRs, Key Results, Teammitglieder und Dateigröße für Uploads. Free-Accounts können keine Unternehmen erstellen und haben stark begrenzte Features.",
    category: "abonnements",
    tags: ["limits", "beschränkungen", "boards", "tasks", "projekte"]
  },
  {
    id: "subscription-upgrade",
    question: "Wie ändere ich mein Abonnement?",
    answer: "Gehen Sie zu Profil > Abonnement und wählen Sie eine neue Stufe. Upgrades werden sofort aktiviert, bei Downgrades am Ende der aktuellen Abrechnungsperiode. Die Abrechnung erfolgt automatisch über Stripe.",
    category: "abonnements",
    tags: ["upgrade", "downgrade", "ändern", "stripe", "abrechnung"]
  },
  {
    id: "company-subscription",
    question: "Wie funktionieren Unternehmensabonnements?",
    answer: "Unternehmensadministratoren können ein Abonnement für das gesamte Unternehmen verwalten. Alle Mitarbeiter profitieren dann von den Features dieses Abonnements. Individual-Abonnements bleiben für persönliche Inhalte bestehen.",
    category: "abonnements",
    tags: ["unternehmen", "firmenabo", "mitarbeiter", "verwaltung"]
  },

  // OKR System
  {
    id: "okr-basics",
    question: "Was sind OKRs und wie funktionieren sie?",
    answer: "OKRs (Objectives and Key Results) helfen bei der Zielsetzung. Ein Objective ist ein qualitatives Ziel, Key Results sind messbare Ergebnisse. Sie können Fortschritte in Prozent verfolgen und OKRs hierarchisch organisieren (Unternehmens-, Team-, Personal-OKRs).",
    category: "okr",
    tags: ["objectives", "key results", "ziele", "fortschritt", "hierarchie"]
  },
  {
    id: "okr-cycles",
    question: "Was sind OKR-Zyklen?",
    answer: "OKR-Zyklen sind Zeiträume (meist Quartale), in denen OKRs verfolgt werden. Sie helfen bei der Planung und regelmäßigen Überprüfung von Zielen. Jeder Zyklus hat Start- und Enddatum und kann verschiedene OKRs enthalten.",
    category: "okr",
    tags: ["zyklen", "quartale", "planung", "zeiträume"]
  },
  {
    id: "okr-permissions",
    question: "Wer kann meine OKRs sehen und bearbeiten?",
    answer: "OKRs folgen demselben Berechtigungssystem wie andere Inhalte. Sie sind nur für Ersteller, zugewiesene Benutzer und Teammitglieder sichtbar. Unternehmens-OKRs können von Administratoren für alle Mitarbeiter sichtbar gemacht werden.",
    category: "okr",
    tags: ["berechtigungen", "sichtbarkeit", "teams", "unternehmen"]
  },

  // Task & Board Management
  {
    id: "boards-vs-tasks",
    question: "Was ist der Unterschied zwischen Boards und Tasks?",
    answer: "Boards sind Container, die Tasks in Spalten organisieren (wie Kanban-Boards). Tasks sind einzelne Aufgaben mit Details wie Beschreibung, Deadline, Zuweisungen, Checklisten und Kommentaren. Jedes Board kann mehrere Spalten und Tasks haben.",
    category: "tasks",
    tags: ["boards", "tasks", "kanban", "spalten", "organisation"]
  },
  {
    id: "task-features",
    question: "Welche Features haben Tasks?",
    answer: "Tasks bieten: Rich-Text-Beschreibungen, Start- und Enddaten, Zuweisungen an Benutzer/Teams, Checklisten, Kommentarsystem, Datei-Anhänge, Labels und Status-Tracking. Sie können zwischen Spalten verschoben werden.",
    category: "tasks",
    tags: ["features", "beschreibung", "zuweisungen", "checklisten", "anhänge"]
  },
  {
    id: "task-assignments",
    question: "Wie funktionieren Task-Zuweisungen?",
    answer: "Tasks können an einzelne Benutzer oder ganze Teams zugewiesen werden. Zugewiesene Personen erhalten Benachrichtigungen und können die Task in ihrem persönlichen Dashboard sehen. Mehrfachzuweisungen sind möglich.",
    category: "tasks",
    tags: ["zuweisungen", "teams", "benutzer", "benachrichtigungen", "dashboard"]
  },

  // Teams & Zusammenarbeit
  {
    id: "teams-create",
    question: "Wie erstelle und verwalte ich Teams?",
    answer: "Teams können von Unternehmensadministratoren oder Benutzern mit entsprechenden Rechten erstellt werden. Teams haben Mitglieder und können an Projekten, Boards und OKRs zugewiesen werden. Teammitglieder sehen alle dem Team zugewiesenen Inhalte.",
    category: "features",
    tags: ["teams", "erstellen", "mitglieder", "zuweisung", "zusammenarbeit"]
  },
  {
    id: "notifications",
    question: "Wie funktioniert das Benachrichtigungssystem?",
    answer: "Sie erhalten Benachrichtigungen für: Task-Zuweisungen, Kommentare, Deadline-Erinnerungen, Team-Einladungen und Projekt-Updates. Benachrichtigungen können in den Einstellungen angepasst werden.",
    category: "features",
    tags: ["benachrichtigungen", "einstellungen", "kommentare", "deadlines", "updates"]
  },

  // Allgemeine Fragen
  {
    id: "data-security",
    question: "Wie sicher sind meine Daten?",
    answer: "Alle Daten werden verschlüsselt übertragen und gespeichert. Zugriff erfolgt nur über sichere Authentifizierung. Berechtigungen werden strikt durchgesetzt - Benutzer sehen nur Inhalte, auf die sie explizit Zugriff haben.",
    category: "allgemein",
    tags: ["sicherheit", "verschlüsselung", "datenschutz", "authentifizierung"]
  },
  {
    id: "mobile-access",
    question: "Kann ich die Plattform auf dem Handy nutzen?",
    answer: "Ja, die Plattform ist vollständig responsiv und funktioniert auf allen Geräten. Alle Features sind sowohl auf Desktop als auch auf mobilen Geräten verfügbar. Eine native App ist in Planung.",
    category: "allgemein",
    tags: ["mobil", "responsiv", "geräte", "app"]
  },
  {
    id: "integrations",
    question: "Welche Integrationen sind verfügbar?",
    answer: "Aktuell integriert: Stripe für Zahlungen, Rich-Text-Editor für Beschreibungen, Datei-Upload-System. Weitere Integrationen (Calendar, Email, Slack) sind in Entwicklung. API-Zugang ist für höhere Abonnements geplant.",
    category: "features",
    tags: ["integrationen", "stripe", "api", "calendar", "entwicklung"]
  }
];

const categories = [
  { id: "alle", name: "Alle", icon: HelpCircle },
  { id: "unternehmen", name: "Unternehmen", icon: Building },
  { id: "benutzer", name: "Benutzer & Rollen", icon: Users },
  { id: "abonnements", name: "Abonnements", icon: CreditCard },
  { id: "okr", name: "OKRs & Ziele", icon: Target },
  { id: "tasks", name: "Tasks & Boards", icon: CheckSquare },
  { id: "features", name: "Features", icon: Crown },
  { id: "allgemein", name: "Allgemein", icon: Shield }
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("alle");
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = searchTerm === "" || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "alle" || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Häufig gestellte Fragen</h1>
        <p className="text-muted-foreground text-lg">
          Finden Sie Antworten zu Unternehmen, Benutzern, Features und allem rund um unsere Plattform
        </p>
      </div>

      {/* Suchbereich */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Durchsuchen Sie die FAQ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Kategorie-Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* FAQ-Ergebnisse */}
      <div className="space-y-4">
        {filteredFAQs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Keine Ergebnisse gefunden</h3>
              <p className="text-muted-foreground">
                Versuchen Sie andere Suchbegriffe oder wählen Sie eine andere Kategorie.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFAQs.map((faq) => (
            <Card key={faq.id}>
              <Collapsible 
                open={openItems.includes(faq.id)}
                onOpenChange={() => toggleItem(faq.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-left text-lg font-medium mb-2">
                          {faq.question}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {categories.find(c => c.id === faq.category)?.name}
                          </Badge>
                          <div className="flex gap-1">
                            {faq.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {faq.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{faq.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {openItems.includes(faq.id) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Weitere Hilfe */}
      <Card className="mt-8">
        <CardContent className="pt-6 text-center">
          <HelpCircle className="h-8 w-8 text-primary mx-auto mb-4" />
          <h3 className="font-medium mb-2">Weitere Fragen?</h3>
          <p className="text-muted-foreground mb-4">
            Konnten Sie nicht finden, wonach Sie gesucht haben? Kontaktieren Sie unser Support-Team.
          </p>
          <Button>
            Support kontaktieren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}