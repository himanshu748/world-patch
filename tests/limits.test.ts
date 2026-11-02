import { describe, it, expect } from 'vitest';
import { Room, ROOM_LIMITS } from '../src/server/room.js';
import { SQLiteStore, STORAGE_LIMITS } from '../src/server/storage.js';

describe('bounded room admission',()=>{
  it('consumes candidate slots even when the host removes previous candidates',()=>{
    let at=100000;const room=new Room({now:()=>at,solverNow:()=>0});
    room.act({type:'startRound'});
    for(let i=1;i<=ROOM_LIMITS.candidates;i++){
      const accepted=room.ingest({origin:'simulation',actorId:`actor-${i}`,eventId:`event-${i}`,messageId:`msg-${i}`,text:'!patch ice on',receivedAt:at});
      expect(accepted.ok).toBe(true);expect(room.snapshot().candidates[0]!.id).toBe(i);
      room.act({type:'removeCandidate',candidateId:i});at+=10;
    }
    const denied=room.ingest({origin:'simulation',actorId:'extra',eventId:'extra',messageId:'extra',text:'!patch ice on',receivedAt:at});
    expect(denied.code).toBe('CANDIDATE_CAP');expect(room.snapshot().game.rules.ice).toBe(false);room.close();
  });
  it('fails safely at the archived session limit without replacing active evidence',()=>{
    const store=new SQLiteStore(':memory:');const room=new Room({store,solverNow:()=>0});
    for(let i=1;i<STORAGE_LIMITS.sessions;i++)room.act({type:'newSession',origin:'simulation'});
    const before=room.snapshot();
    expect(()=>room.act({type:'newSession',origin:'simulation'})).toThrow(/not saved/);
    expect(room.snapshot()).toEqual(before);room.close();
  });
});
