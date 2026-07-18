/**
 * LMG Sync — GitHub-backed multi-user project storage
 * Token is entered once per device and stored locally — never in source code.
 * All PMs use the same token to access shared project storage.
 */

const LMGSync = (() => {
  const REPO = 'blackrockagent008/lmg-projects-data';
  const API  = 'https://api.github.com/repos/' + REPO + '/contents/';

  function token(){ return localStorage.getItem('lmg_gh_token') || ''; }
  const hdrs = () => ({
    'Authorization': 'token ' + token(),
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json'
  });
  const b64e = s => { try{ return btoa(unescape(encodeURIComponent(s))); }catch(e){ return btoa(s); } };
  const b64d = s => { try{ return decodeURIComponent(escape(atob(s.replace(/\n/g,'')))); }catch(e){ return atob(s.replace(/\n/g,'')); } };
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  async function getFile(path){
    try{
      const r = await fetch(API+path, {headers:hdrs()});
      if(r.status===404) return null;
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d = await r.json();
      return { data: JSON.parse(b64d(d.content)), sha: d.sha };
    }catch(e){ console.warn('LMGSync.get',path,e.message); return null; }
  }

  async function putFile(path, data, sha, message){
    try{
      const body = { message, content: b64e(JSON.stringify(data,null,2)) };
      if(sha) body.sha = sha;
      const r = await fetch(API+path, {method:'PUT',headers:hdrs(),body:JSON.stringify(body)});
      if(!r.ok){ const e=await r.json(); throw new Error(e.message||r.status); }
      const d = await r.json();
      return d.content?.sha||null;
    }catch(e){ console.warn('LMGSync.put',path,e.message); return null; }
  }

  async function listDir(path){
    try{
      const r = await fetch(API+path,{headers:hdrs()});
      if(!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d)?d:[];
    }catch(e){ return []; }
  }

  return {
    genId,
    hasToken(){ return !!token(); },
    setToken(t){ localStorage.setItem('lmg_gh_token',t.trim()); },
    clearToken(){ localStorage.removeItem('lmg_gh_token'); },

    async ping(){
      if(!token()) return false;
      try{ const r=await fetch('https://api.github.com/repos/'+REPO,{headers:hdrs()}); return r.ok; }
      catch(e){ return false; }
    },

    async listProjects(tool){
      const files = await listDir(tool+'-projects/');
      return files.filter(f=>f.name.endsWith('.json')).map(f=>({
        id:f.name.replace('.json',''), sha:f.sha
      }));
    },

    async loadProject(tool, projectId){
      return await getFile(tool+'-projects/'+projectId+'.json');
    },

    async saveProject(tool, projectId, data, existingSha, pmName){
      const path = tool+'-projects/'+projectId+'.json';
      const ts = new Date().toISOString();
      const payload = {...data, projectId, _lastModified:ts, _lastModifiedBy:pmName||'PM', _tool:tool};
      const msg = '['+( pmName||'PM')+'] '+(data.project?.name||projectId)+' — '+new Date().toLocaleTimeString();
      const sha = await putFile(path, payload, existingSha, msg);
      return { sha, ts };
    }
  };
})();
