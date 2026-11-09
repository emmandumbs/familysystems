import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Heart,
  Plus,
  Search,
  CheckCircle2,
  Phone,
  Mail,
  Gift,
  Star,
  Printer,
  Trash2,
  Edit3,
  AlertCircle,
} from 'lucide-react';

export interface ExternalContact {
  id: string;
  name: string;
  category: 'FRIEND' | 'MENTOR' | 'PROFESSIONAL' | 'NEIGHBOR' | 'COMMUNITY' | 'EXTENDED_FAMILY';
  phone?: string;
  email?: string;
  birthday?: string; // YYYY-MM-DD
  importantEvent?: string;
  eventDate?: string; // YYYY-MM-DD
  giftIdeas?: string;
  checkInCadence: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  lastCheckedIn?: string; // ISO Date string
  notes?: string;
  interactionHistory: Array<{
    id: string;
    date: string;
    method: 'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Other';
    summary: string;
  }>;
}

export interface ExternalNetworkCRMProps {
  selectedRole: string;
  sessionToken: string;
}

const INITIAL_EXTERNAL_CONTACTS: ExternalContact[] = [
  {
    id: 'ext-1',
    name: 'Dr. Marcus Vance',
    category: 'MENTOR',
    phone: '+1 (555) 234-5678',
    email: 'marcus.vance@university.edu',
    birthday: '1975-04-12',
    importantEvent: 'Annual Research Symposium',
    eventDate: '2026-11-18',
    giftIdeas: 'Bestselling biography book, artisan coffee beans',
    checkInCadence: 'MONTHLY',
    lastCheckedIn: new Date(Date.now() - 14 * 86400000).toISOString(),
    notes: 'Long-time career mentor and academic advisor.',
    interactionHistory: [
      { id: 'ih-1', date: '2026-10-20', method: 'Coffee / Meetup', summary: 'Discussed Q4 leadership goals and mentorship roadmap.' }
    ]
  },
  {
    id: 'ext-2',
    name: 'Elena Rostova',
    category: 'FRIEND',
    phone: '+1 (555) 876-5432',
    email: 'elena.rostova@designstudio.co',
    birthday: '1990-08-25',
    importantEvent: 'Design Exhibition Opening',
    eventDate: '2026-12-05',
    giftIdeas: 'Handmade ceramic planter, sketch notebook',
    checkInCadence: 'WEEKLY',
    lastCheckedIn: new Date(Date.now() - 5 * 86400000).toISOString(),
    notes: 'College roommate and creative collaborator.',
    interactionHistory: [
      { id: 'ih-2', date: '2026-10-28', method: 'Call', summary: 'Catch-up call regarding upcoming holiday travel plans.' }
    ]
  },
  {
    id: 'ext-3',
    name: 'Arthur Pendelton',
    category: 'NEIGHBOR',
    phone: '+1 (555) 345-6789',
    email: 'arthur.p@suburbanmail.net',
    birthday: '1962-11-14',
    importantEvent: 'Neighborhood Holiday Potluck',
    eventDate: '2026-12-15',
    giftIdeas: 'Homemade sourdough loaf, artisanal olive oil',
    checkInCadence: 'MONTHLY',
    lastCheckedIn: new Date(Date.now() - 22 * 86400000).toISOString(),
    notes: 'Next-door neighbor, avid gardener and woodworking expert.',
    interactionHistory: [
      { id: 'ih-3', date: '2026-10-12', method: 'Message', summary: 'Shared garden produce and discussed fence repairs.' }
    ]
  }
];

export const ExternalNetworkCRM: React.FC<ExternalNetworkCRMProps> = ({
  selectedRole,
  sessionToken,
}) => {
  const [contacts, setContacts] = useState<ExternalContact[]>(() => {
    try {
      const saved = localStorage.getItem('familyos_external_contacts');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_EXTERNAL_CONTACTS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);

  // New Contact Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ExternalContact['category']>('FRIEND');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newGiftIdeas, setNewGiftIdeas] = useState('');
  const [newCadence, setNewCadence] = useState<ExternalContact['checkInCadence']>('MONTHLY');
  const [newNotes, setNewNotes] = useState('');

  // Interaction Modal State
  const [activeCheckInContact, setActiveCheckInContact] = useState<ExternalContact | null>(null);
  const [interactionMethod, setInteractionMethod] = useState<'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Other'>('Call');
  const [interactionSummary, setInteractionSummary] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('familyos_external_contacts', JSON.stringify(contacts));
    } catch {
      // Ignore
    }
  }, [contacts]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newContact: ExternalContact = {
      id: `ext-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      birthday: newBirthday || undefined,
      importantEvent: newEventTitle.trim() || undefined,
      eventDate: newEventDate || undefined,
      giftIdeas: newGiftIdeas.trim() || undefined,
      checkInCadence: newCadence,
      lastCheckedIn: new Date().toISOString(),
      notes: newNotes.trim() || undefined,
      interactionHistory: [],
    };

    setContacts((prev) => [newContact, ...prev]);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewBirthday('');
    setNewEventTitle('');
    setNewEventDate('');
    setNewGiftIdeas('');
    setNewNotes('');
    setIsAddModalOpen(false);
  };

  const handleRecordInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckInContact) return;

    const nowIso = new Date().toISOString();
    const newLog = {
      id: `ih-${Date.now()}`,
      date: nowIso.slice(0, 10),
      method: interactionMethod,
      summary: interactionSummary.trim() || `Checked in via ${interactionMethod}`,
    };

    setContacts((prev) =>
      prev.map((c) =>
        c.id === activeCheckInContact.id
          ? {
              ...c,
              lastCheckedIn: nowIso,
              interactionHistory: [newLog, ...c.interactionHistory],
            }
          : c
      )
    );

    setActiveCheckInContact(null);
    setInteractionSummary('');
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.importantEvent?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#173D35] to-[#0A1E19] text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-emerald-900/40">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#E5C388] uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Personal CRM & External Network</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">Friends, Mentors & Extended Network</h2>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl">
            Maintain meaningful relationships outside your immediate household. Track check-in cadences (weekly catch-ups and monthly reminders), remember birthdays, and never miss important events.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d4ab71] text-[#173D35] text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPrintReportOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print CRM & Birthdays</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts, notes, events..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-[#173D35] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {['ALL', 'FRIEND', 'MENTOR', 'PROFESSIONAL', 'NEIGHBOR', 'COMMUNITY', 'EXTENDED_FAMILY'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#173D35] text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat === 'ALL' ? 'All Contacts' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.length === 0 ? (
          <div className="col-span-full rounded-3xl p-12 bg-white border border-stone-200 text-center space-y-3">
            <Users className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-serif font-bold text-lg text-stone-800">No external contacts found</h3>
            <p className="text-xs text-stone-500">Add your first outside contact, mentor, or friend to start tracking check-ins.</p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const lastCheckDate = contact.lastCheckedIn ? new Date(contact.lastCheckedIn) : null;
            const daysAgo = lastCheckDate ? Math.floor((Date.now() - lastCheckDate.getTime()) / 86400000) : 999;
            const isOverdue =
              (contact.checkInCadence === 'WEEKLY' && daysAgo > 7) ||
              (contact.checkInCadence === 'MONTHLY' && daysAgo > 30) ||
              (contact.checkInCadence === 'QUARTERLY' && daysAgo > 90);

            return (
              <div
                key={contact.id}
                className="rounded-3xl p-6 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4 transition-all hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 uppercase tracking-wider">
                        {contact.category.replace('_', ' ')}
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900 mt-1">{contact.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-1.5 text-xs text-stone-600">
                    {contact.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="font-mono">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.birthday && (
                      <div className="flex items-center space-x-2">
                        <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Birthday: <strong>{contact.birthday}</strong></span>
                      </div>
                    )}
                    {contact.importantEvent && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{contact.importantEvent} ({contact.eventDate || 'Upcoming'})</span>
                      </div>
                    )}
                  </div>

                  {contact.giftIdeas && (
                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-950">
                      <strong>Gift Ideas:</strong> {contact.giftIdeas}
                    </div>
                  )}

                  {contact.notes && (
                    <p className="text-xs text-stone-500 italic leading-relaxed">“{contact.notes}”</p>
                  )}
                </div>

                {/* Check-in Status & Action */}
                <div className="pt-3 border-t border-stone-100 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Cadence: <strong>{contact.checkInCadence}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOverdue ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {isOverdue ? `⚠️ Check-in due (${daysAgo}d ago)` : `✓ Checked in ${daysAgo}d ago`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveCheckInContact(contact)}
                    className="w-full py-2 px-3 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Check In Now</span>
                  </button>

                  {contact.interactionHistory.length > 0 && (
                    <div className="text-[11px] text-stone-500 pt-1">
                      Last log ({contact.interactionHistory[0].date}): {contact.interactionHistory[0].summary}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <h3 className="font-serif font-bold text-xl text-stone-950">Add External Network Contact</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Dr. Jane Smith"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="FRIEND">Friend</option>
                    <option value="MENTOR">Mentor</option>
                    <option value="PROFESSIONAL">Professional Network</option>
                    <option value="NEIGHBOR">Neighbor</option>
                    <option value="COMMUNITY">Community</option>
                    <option value="EXTENDED_FAMILY">Extended Family</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Birthday</label>
                  <input
                    type="date"
                    value={newBirthday}
                    onChange={(e) => setNewBirthday(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Check-in Cadence</label>
                  <select
                    value={newCadence}
                    onChange={(e) => setNewCadence(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold"
                  >
                    <option value="WEEKLY">Weekly Catch-up (Ping)</option>
                    <option value="MONTHLY">Monthly Reminder</option>
                    <option value="QUARTERLY">Quarterly Check-in</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Important Event / Anniversary</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Book Launch / Anniversary"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Gift Ideas & Interests</label>
                <input
                  type="text"
                  value={newGiftIdeas}
                  onChange={(e) => setNewGiftIdeas(e.target.value)}
                  placeholder="e.g. Sci-fi books, hiking gear, dark chocolate"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Personal Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="How you met, family details, professional background..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-bold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-In Action Modal */}
      {activeCheckInContact && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">Log Check-In</h3>
                <p className="text-xs text-stone-500">Record interaction with {activeCheckInContact.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckInContact(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordInteraction} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Contact Method</label>
                <select
                  value={interactionMethod}
                  onChange={(e) => setInteractionMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold"
                >
                  <option value="Call">Phone Call</option>
                  <option value="Message">Text Message / WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Coffee / Meetup">Coffee / In-Person Meetup</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Interaction Summary & Notes</label>
                <textarea
                  rows={3}
                  required
                  value={interactionSummary}
                  onChange={(e) => setInteractionSummary(e.target.value)}
                  placeholder="What did you discuss? Any follow-up items..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCheckInContact(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-bold"
                >
                  Save Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print CRM & Birthdays Report Modal */}
      {isPrintReportOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div id="household-print-area" className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  Personal CRM & Network Report
                </span>
                <h3 className="text-2xl font-serif font-bold text-stone-900 mt-1">
                  External Contacts, Birthdays & Events Master Report
                </h3>
                <p className="text-xs text-stone-500">Generated: {new Date().toLocaleString()} • Total Contacts: {contacts.length}</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintReportOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs text-stone-800">
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-stone-100 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Phone / Email</th>
                      <th className="p-3">Birthday</th>
                      <th className="p-3">Important Event</th>
                      <th className="p-3">Cadence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {contacts.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="p-3 font-semibold text-stone-900">{c.name}</td>
                        <td className="p-3 uppercase text-[10px] font-bold text-emerald-900">{c.category}</td>
                        <td className="p-3 font-mono text-[11px]">{c.phone || c.email || '—'}</td>
                        <td className="p-3 font-mono">{c.birthday || '—'}</td>
                        <td className="p-3">{c.importantEvent ? `${c.importantEvent} (${c.eventDate || 'Soon'})` : '—'}</td>
                        <td className="p-3 font-bold">{c.checkInCadence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
