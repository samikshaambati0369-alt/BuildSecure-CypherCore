import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, ReceiptText, WalletCards, Bot, FileDown, UserCircle, LogOut, Plus, ShieldCheck, ArrowUpRight, ArrowDownRight, Trash2, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from './api';

const categories = ['Food','Transport','Education','Shopping','Entertainment','Bills','Healthcare','Rent','Other'];

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({name:'',email:'',password:''});
  const [message, setMessage] = useState('');

  const loadData = async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const [me, dash, tx, bs] = await Promise.all([
        api.get('/auth/me'), api.get('/dashboard'), api.get('/transactions'), api.get('/budgets')
      ]);
      setUser(me.data.data);
      setDashboard(dash.data.data);
      setTransactions(tx.data.data);
      setBudgets(bs.data.data);
    } catch (e) {
      if (e.response?.status === 401) logout();
      else setMessage(e.response?.data?.message || 'Unable to load data');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    api.get('/auth/me')
      .then(r => { if (active) { setUser(r.data.data); setAuthenticated(true); } })
      .catch(() => { if (active) setAuthenticated(false); })
      .finally(() => { if (active) setCheckingAuth(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (authenticated) loadData(); }, [authenticated]);

  const login = async e => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login'
        ? {email: authForm.email, password: authForm.password}
        : authForm;
      const r = await api.post(endpoint, payload);
      if (authMode === 'login') {
        setAuthenticated(true);
        setUser(r.data.data.user);
        setMessage('');
      } else {
        setAuthMode('login');
        setMessage('Account created. Please login.');
      }
    } catch (e) { setMessage(e.response?.data?.message || 'Request failed'); }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setAuthenticated(false); setUser(null); setDashboard(null); setTransactions([]); setBudgets([]);
  };

  if (checkingAuth) return <div className="auth-page"><div className="auth-card"><div className="loading-bar"/><p className="muted">Checking secure session...</p></div></div>;
  if (!authenticated) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} onSubmit={login} message={message} />;

  const nav = [
    ['dashboard','Dashboard',LayoutDashboard],
    ['transactions','Transactions',ReceiptText],
    ['budget','Budget',WalletCards],
    ['ai','AI Assistant',Bot],
    ['reports','Reports',FileDown],
    ['profile','Profile',UserCircle]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><div><strong>FinTrack</strong><small>Secure Finance</small></div></div>
        <nav>{nav.map(([id,label,Icon]) => <button className={page===id?'nav-item active':'nav-item'} onClick={()=>setPage(id)} key={id}><Icon size={19}/>{label}</button>)}</nav>
        <div className="side-bottom"><div className="security-badge"><ShieldCheck size={17}/><span>Protected</span></div><button className="nav-item" onClick={logout}><LogOut size={19}/>Logout</button></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">PERSONAL FINANCE</span><h1>{nav.find(x=>x[0]===page)?.[1] || 'Dashboard'}</h1></div>
          <div className="user-chip"><div className="avatar">{user?.name?.[0]?.toUpperCase()}</div><div><strong>{user?.name}</strong><small>{user?.email}</small></div></div>
        </header>
        {message && <div className="notice">{message}<button onClick={()=>setMessage('')}>×</button></div>}
        {loading && <div className="loading-bar"/>}
        {page==='dashboard' && <Dashboard data={dashboard} />}
        {page==='transactions' && <Transactions transactions={transactions} reload={loadData} setMessage={setMessage}/>}
        {page==='budget' && <Budget budgets={budgets} reload={loadData} setMessage={setMessage}/>}
        {page==='ai' && <AI setMessage={setMessage}/>}
        {page==='reports' && <Reports setMessage={setMessage}/>}
        {page==='profile' && <Profile user={user}/>}
      </main>
    </div>
  );
}

function AuthScreen({mode,setMode,form,setForm,onSubmit,message}) {
  return <div className="auth-page">
    <div className="auth-glow glow-one"/><div className="auth-glow glow-two"/>
    <div className="auth-card">
      <div className="brand auth-brand"><div className="brand-mark">F</div><div><strong>FinTrack</strong><small>Secure personal finance</small></div></div>
      <span className="eyebrow">CIPHERCORE FINTECH</span>
      <h1>{mode==='login'?'Welcome back':'Create your account'}</h1>
      <p className="muted">{mode==='login'?'Track smarter. Budget better.':'Start managing your finances securely.'}</p>
      <form onSubmit={onSubmit}>
        {mode==='register' && <input placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>}
        <input type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/>
        <input type="password" placeholder="Password (10+ characters)" minLength="10" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/>
        {message && <div className="form-message">{message}</div>}
        <button className="primary wide" type="submit">{mode==='login'?'Sign in':'Create account'} <ArrowUpRight size={17}/></button>
      </form>
      <button className="link-btn" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'New to FinTrack? Create an account':'Already have an account? Sign in'}</button>
      <div className="secure-note"><ShieldCheck size={16}/> Your financial data is protected with secure authentication.</div>
    </div>
  </div>;
}

function Dashboard({data}) {
  if (!data) return <div className="empty">No dashboard data yet. Add your first transaction.</div>;
  return <div className="page-content">
    <section className="hero-card"><div><span className="eyebrow light">YOUR FINANCIAL SNAPSHOT</span><h2>Know your money. <span>Own your decisions.</span></h2><p>Track spending, stay within budget and turn your data into actionable insights.</p></div><div className="hero-icon"><Sparkles size={34}/></div></section>
    <div className="stats-grid">
      <Stat title="Total Income" value={data.summary.income} icon={ArrowUpRight} type="income"/>
      <Stat title="Total Expenses" value={data.summary.expenses} icon={ArrowDownRight} type="expense"/>
      <Stat title="Current Balance" value={data.summary.balance} icon={WalletCards}/>
      <Stat title="Tracked Categories" value={data.categories.length} raw/>
    </div>
    <div className="grid-two">
      <section className="panel"><div className="panel-head"><div><h3>Spending by category</h3><p>Where your money is going</p></div></div>
        {data.categories.length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={data.categories} dataKey="total" nameKey="category" innerRadius={75} outerRadius={105} paddingAngle={3}>{data.categories.map((_,i)=><Cell key={i}/>)}</Pie><Tooltip formatter={v=>`₹${Number(v).toLocaleString()}`}/></PieChart></ResponsiveContainer> : <div className="empty small">Add expenses to see your spending pattern.</div>}
      </section>
      <section className="panel"><div className="panel-head"><div><h3>Budget health</h3><p>Current tracked budgets</p></div></div>
        {data.budgets.length ? data.budgets.slice(0,4).map(b=><BudgetProgress key={b.id} b={b}/>) : <div className="empty small">Create a budget to monitor your spending.</div>}
      </section>
    </div>
    <section className="panel"><div className="panel-head"><div><h3>Recent transactions</h3><p>Your latest financial activity</p></div></div><TransactionTable rows={data.recent}/></section>
  </div>;
}

function Stat({title,value,icon:Icon,type,raw}) {
  return <div className="stat-card"><div className="stat-icon"><Icon size={18}/></div><span>{title}</span><strong>{raw?value:`₹${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})}`}</strong>{type && <small className={type}>{type==='income'?'Money in':'Money out'}</small>}</div>;
}

function Transactions({transactions,reload,setMessage}) {
  const [form,setForm]=useState({type:'EXPENSE',amount:'',category:'Food',description:'',transaction_date:new Date().toISOString().slice(0,10)});
  const [filter,setFilter]=useState('');
  const add = async e => { e.preventDefault(); try { await api.post('/transactions',form); setForm({...form,amount:'',description:''}); setMessage('Transaction added successfully'); reload(); } catch(e){setMessage(e.response?.data?.message||'Unable to add transaction');} };
  const del = async id => { if(!confirm('Delete this transaction?')) return; try {await api.delete(`/transactions/${id}`); reload();} catch(e){setMessage('Unable to delete transaction');} };
  const shown=transactions.filter(t=>!filter||t.type===filter);
  return <div className="page-content"><div className="grid-two">
    <section className="panel"><div className="panel-head"><div><h3>Add transaction</h3><p>Record income or expense</p></div><Plus size={20}/></div>
      <form className="stack-form" onSubmit={add}><div className="segmented"><button type="button" className={form.type==='EXPENSE'?'selected':''} onClick={()=>setForm({...form,type:'EXPENSE'})}>Expense</button><button type="button" className={form.type==='INCOME'?'selected':''} onClick={()=>setForm({...form,type:'INCOME'})}>Income</button></div>
      <input type="number" min="0.01" step="0.01" placeholder="Amount (₹)" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select>
      <input type="date" value={form.transaction_date} onChange={e=>setForm({...form,transaction_date:e.target.value})} required/>
      <input placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <button className="primary wide">Save transaction</button></form>
    </section>
    <section className="panel"><div className="panel-head"><div><h3>Transaction history</h3><p>Search and manage your records</p></div><select className="compact" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All</option><option value="INCOME">Income</option><option value="EXPENSE">Expenses</option></select></div><TransactionTable rows={shown} onDelete={del}/></section>
  </div></div>;
}

function TransactionTable({rows,onDelete}) {
  if(!rows?.length) return <div className="empty small">No transactions yet.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Amount</th>{onDelete&&<th/>}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{String(r.transaction_date).slice(0,10)}</td><td><strong>{r.category}</strong><small>{r.description}</small></td><td><span className={`pill ${r.type.toLowerCase()}`}>{r.type}</span></td><td className={r.type==='INCOME'?'amount-income':'amount-expense'}>{r.type==='INCOME'?'+':'-'}₹{Number(r.amount).toLocaleString()}</td>{onDelete&&<td><button className="icon-btn danger" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></td>}</tr>)}</tbody></table></div>;
}

function Budget({budgets,reload,setMessage}) {
  const [form,setForm]=useState({category:'Food',amount:'',period:'MONTHLY',start_date:new Date().toISOString().slice(0,8)+'01',end_date:new Date().toISOString().slice(0,10)});
  const add=async e=>{e.preventDefault();try{await api.post('/budgets',form);setForm({...form,amount:''});setMessage('Budget created');reload();}catch(e){setMessage(e.response?.data?.message||'Unable to create budget');}};
  const del=async id=>{if(confirm('Delete this budget?')){await api.delete(`/budgets/${id}`);reload();}};
  return <div className="page-content"><div className="grid-two"><section className="panel"><div className="panel-head"><div><h3>Create a budget</h3><p>Set limits for spending categories</p></div><WalletCards size={20}/></div><form className="stack-form" onSubmit={add}><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select><input type="number" min="0.01" step="0.01" placeholder="Budget amount (₹)" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/><select value={form.period} onChange={e=>setForm({...form,period:e.target.value})}><option>MONTHLY</option><option>WEEKLY</option><option>CUSTOM</option></select><div className="date-row"><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div><button className="primary wide">Create budget</button></form></section><section className="panel"><div className="panel-head"><div><h3>Your budgets</h3><p>Monitor limits and actual spending</p></div></div>{budgets.length?budgets.map(b=><div className="budget-row" key={b.id}><div className="budget-title"><strong>{b.category}</strong><button className="icon-btn danger" onClick={()=>del(b.id)}><Trash2 size={15}/></button></div><BudgetProgress b={b}/></div>):<div className="empty small">No budgets created yet.</div>}</section></div></div>;
}

function BudgetProgress({b}) {
  const pct=Math.min(100,Math.round(Number(b.spent)/Number(b.amount)*100));
  return <div className="progress-wrap"><div className="progress-meta"><span>₹{Number(b.spent).toLocaleString()} spent</span><span>₹{Number(b.amount).toLocaleString()}</span></div><div className="progress"><i style={{width:`${pct}%`}}/></div><small className={pct>=100?'over':''}>{pct}% used</small></div>;
}

function AI({setMessage}) {
  const [q,setQ]=useState('Analyze my spending and give me practical budgeting suggestions.');
  const [answer,setAnswer]=useState('');
  const [loading,setLoading]=useState(false);
  const ask=async e=>{e.preventDefault();setLoading(true);try{const r=await api.post('/ai/insights',{question:q});setAnswer(r.data.data.answer);}catch(e){setMessage(e.response?.data?.message||'AI request failed');}finally{setLoading(false);}};
  return <div className="page-content"><section className="ai-hero"><div className="ai-orb"><Bot size={34}/></div><span className="eyebrow">AI FINANCIAL ASSISTANT</span><h2>Turn your spending data into <span>useful decisions.</span></h2><p>The assistant analyzes only your authorized financial context and provides practical budgeting guidance.</p></section><section className="panel ai-panel"><form onSubmit={ask}><textarea value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about your spending..." rows="4"/><button className="primary">{loading?'Analyzing...':'Get AI insight'} <Sparkles size={17}/></button></form>{answer&&<div className="ai-answer"><div className="answer-label"><Sparkles size={17}/> FINTRACK INSIGHT</div><p>{answer}</p></div>}</section></div>;
}

function Reports({setMessage}) {
  const download=async()=>{try{const r=await api.get('/reports/csv',{responseType:'blob'});const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download='fintrack-report.csv';a.click();URL.revokeObjectURL(url);setMessage('Report downloaded');}catch(e){setMessage('Unable to export report');}};
  return <div className="page-content"><section className="panel export-card"><div className="export-icon"><FileDown size={30}/></div><span className="eyebrow">SECURE EXPORT</span><h2>Your financial report</h2><p>Download the transactions belonging to your authenticated account. The export is generated server-side.</p><button className="primary" onClick={download}>Download CSV <FileDown size={17}/></button></section></div>;
}

function Profile({user}) {
  return <div className="page-content"><section className="profile-card"><div className="large-avatar">{user?.name?.[0]?.toUpperCase()}</div><span className="eyebrow">ACCOUNT PROFILE</span><h2>{user?.name}</h2><p>{user?.email}</p><span className="role-pill"><ShieldCheck size={15}/> {user?.role}</span><div className="profile-security"><ShieldCheck size={18}/><div><strong>Security by design</strong><p>Authentication, authorization and server-side ownership checks protect your account data.</p></div></div></section></div>;
}

export default App;
