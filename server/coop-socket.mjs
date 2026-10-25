import { WebSocketServer, WebSocket } from 'ws';

/** Same-origin, one authenticated duplex connection; capability never appears in its URL. */
export function attachCoopSockets(server, service) {
  const wss = new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  const upgrade = (req,socket,head) => {
    if(wss.clients.size>=64){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
    const match = /^\/api\/coop\/([A-Z2-9]{6})\/socket$/.exec(new URL(req.url,'http://local').pathname);
    if(!match){socket.destroy();return;}
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,match[1]));
  };
  server.on('upgrade',upgrade);
  wss.on('connection',(ws,code)=>{
    let token,windowAt=Date.now(),count=0;
    const send=value=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));};
    const deadline=setTimeout(()=>ws.close(1008,'authentication required'),5000);deadline.unref();
    ws.on('error',()=>{});
    ws.on('message',(bytes,binary)=>{
      let packet;
      try{
        if(binary)throw Object.assign(new Error('消息格式无效'),{status:400});
        if(Date.now()-windowAt>=1000){windowAt=Date.now();count=0;}if(++count>40){ws.close(1008,'rate limit');return;}
        packet=JSON.parse(bytes.toString());
        if(!packet||typeof packet!=='object'||Array.isArray(packet))throw new Error('消息格式无效');
        if(!token){
          if(packet.type!=='auth'||typeof packet.token!=='string'||Object.keys(packet).some(k=>!['type','token','version'].includes(k)))throw new Error('会话无效');
          service.assertVersion(packet.version);service.auth(code,packet.token);
          const adapter={
            get writableEnded(){return ws.readyState!==WebSocket.OPEN;},get writableLength(){return ws.bufferedAmount;},
            sendSnapshot(data){send({type:'snapshot',data});},
            status(){return this;},set(){return this;},flushHeaders(){},on(event,fn){ws.on(event,fn);},end(){ws.close(1000);},
            write(chunk){const event=/^event: (\w+)\ndata: ([^\n]+)/.exec(chunk);if(event)send({type:event[1],data:JSON.parse(event[2])});return ws.bufferedAmount<256*1024;},
          };
          service.reconnect(code,packet.token,adapter);token=packet.token;clearTimeout(deadline);return;
        }
        if(!Number.isSafeInteger(packet.id)||packet.id<0||Object.keys(packet).some(k=>!['id','type','data'].includes(k)))throw Object.assign(new Error('消息格式无效'),{status:400});
        let data;
        switch(packet.type){
          case 'input':data=service.input(code,token,packet.data);break;
          case 'ready':data=service.setReady(code,token,packet.data?.ready);break;
          case 'start':{const room=service.auth(code,token);data=service.start(code,service.findPlayer(room,token));break;}
          case 'respawn':data=service.respawn(code,token);break;
          case 'leave':send({type:'ack',id:packet.id,data:{ok:true}});service.leave(code,token);return;
          case 'ping':send({type:'pong',id:packet.id});return;
          default:throw Object.assign(new Error('未知操作'),{status:400});
        }
        send({type:'ack',id:packet.id,data});
      }catch(error){send({type:'error',id:packet?.id,status:error.status??400,error:error.message});if(!token)ws.close(1008,'authentication failed');}
    });
    ws.on('close',()=>clearTimeout(deadline));
  });
  let closed=false;
  const close=()=>{if(closed)return;closed=true;server.off('upgrade',upgrade);for(const ws of wss.clients)ws.terminate();wss.close();};
  server.once('close',close);return close;
}
