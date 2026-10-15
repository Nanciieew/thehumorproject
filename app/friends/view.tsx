"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ego } from "@/lib/ego/client";
import type { Friend, Person } from "@/lib/ego/types";
import { ChallengeCreator } from "../ego-ui";
export function FriendsView(){const [friends,setFriends]=useState<Friend[]>([]);const [people,setPeople]=useState<Person[]>([]);const [query,setQuery]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>setFriends(await ego<Friend[]>("friends")),[]);
 useEffect(()=>{let active=true;void ego<Friend[]>("friends").then(r=>{if(active)setFriends(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function act(action:string,data:object){setBusy(true);setError("");try{await ego(action,data);await load();}catch(e){setError(e instanceof Error?e.message:"Couldn’t update friends.");}finally{setBusy(false);}}
 async function search(){setBusy(true);setError("");try{setPeople(await ego<Person[]>("search_people",{query}));}catch(e){setError(e instanceof Error?e.message:"Search unavailable.");}finally{setBusy(false);}}
 return <main id="main" className="ego-page"><header className="ego-hero"><h1>Your accomplices.</h1></header>{error&&<p role="alert" className="ego-panel">{error}</p>}
 <section className="ego-panel"><h2>Find a friend.</h2><form className="ego-actions" onSubmit={e=>{e.preventDefault();void search();}}><label>Name<input value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} placeholder="At least 2 characters"/></label><button className="ego-button" disabled={busy||query.trim().length<2}>Search</button></form><ul className="ego-list">{people.map(p=><li key={p.id}><strong>{p.name}</strong>{friends.some(f=>f.user_id===p.id)?<span>Connected / pending</span>:<button disabled={busy} onClick={()=>void act("friend_request",{userId:p.id})}>Add friend</button>}</li>)}</ul></section>
 <section className="ego-panel"><h2>Your circle.</h2>{!friends.length&&<p>No accomplices yet.</p>}<ul className="ego-list">{friends.map(f=><li key={f.id}><strong>{f.name}</strong><span>{f.status==="accepted"?"Friend":f.incoming?"Incoming request":"Request sent"}</span><div className="ego-actions">{f.incoming&&f.status==="pending"&&<button disabled={busy} onClick={()=>void act("friend_accept",{id:f.id})}>Accept</button>}<button disabled={busy} onClick={()=>void act("friend_remove",{id:f.id})}>{f.status==="accepted"?"Remove friend":f.incoming?"Decline":"Cancel request"}</button></div></li>)}</ul><details className="ego-details"><summary>Friends-only privacy</summary><p className="ego-note">Removing a friend revokes access through that friendship. Another mutual connection may still grant access.</p></details><Link className="ego-link" href="/challenges?scope=mine">Battle invitations →</Link></section><ChallengeCreator/>
 </main>;
}
