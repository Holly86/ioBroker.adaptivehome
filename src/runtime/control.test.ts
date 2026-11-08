import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { ControlClient, OperationGuard, signedContent, verifyControl } from './control';
describe('AP-19 scoped operation protocol', () => {
    it('rejects stale revisions, expired controls and replays after a completed operation', async () => {
        const guard = new OperationGuard(async () => undefined),payload = {requestId:'one',expiresAt:2000,expectedRevision:1};
        const first = await guard.reserve('admin',payload,1,1000);assert.equal(first.duplicate,false);
        await assert.rejects(guard.reserve('admin',payload,1,1001),/uncertain/);await guard.complete(first.key,{ok:true});
        assert.equal((await guard.reserve('admin',payload,2,1002)).duplicate,true);
        await assert.rejects(guard.reserve('admin',{...payload,requestId:'old',expectedRevision:0},1,1000),/revision/);
        await assert.rejects(guard.reserve('admin',{...payload,requestId:'expired',expiresAt:999},1,1000),/expired/);
    });
    it('binds optional remote control to the trusted sender, user, chat and scope', () => {
        const secret = 'synthetic-secret-for-contract-tests-only',client:ControlClient = {id:'own',sender:'system.adapter.gateway.0',userId:'synthetic-user',chatId:'synthetic-chat',functions:['light'],actions:['manual']};
        const unsigned = {clientId:'own',requestId:'one',expectedRevision:1,expiresAt:2000,functionId:'light',action:'manual' as const,value:true,userId:client.userId,chatId:client.chatId,forwarded:false as const};
        const envelope = {...unsigned,signature:createHmac('sha256',secret).update(signedContent(unsigned)).digest('hex')};
        assert.equal(verifyControl(client.sender,envelope,[client],secret).functionId,'light');
        assert.throws(() => verifyControl(client.sender,{...envelope,chatId:'other'},[client],secret),/scope/);
        assert.throws(() => verifyControl(client.sender,{...envelope,forwarded:true},[client],secret));
        assert.throws(() => verifyControl('system.adapter.email.0',envelope,[client],secret),/scope/);
    });
});
