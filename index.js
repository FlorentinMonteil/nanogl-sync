var when = require('when');



var __pool = [];

var _autoi;

function _auto( interval ){
  if( interval === undefined ){
    interval = 32;
  }
  _stop();
  _autoi = setInterval( _resolve, interval );
}

function _stop(){
  clearInterval( _autoi );
}


function _resolve(){
  for (var i = __pool.length - 1; i >= 0; i--) {
    if( __pool[i].isSync() ){
      __pool[i]._complete();
    }
  }
}


function _factory( gl ){
  if( gl.fenceSync ){
    return new NativeImpl( gl );
  } else {
    return new ShimImpl();
  }
}



/**
 * @class
 * @classdesc 
 *
 *  @param {WebGLRenderingContext} gl webgl context the vao belongs to
 */
function Sync( gl ){

  this.gl = gl;
  this._sync        = null;
  this._invalidated = false;
  this._pooled      = false;

  this._defer  = when.defer();
  this.promise = this._defer.promise;

}


Sync.resolve = _resolve;
Sync.auto = _auto;
Sync.stop = _stop;


Sync.prototype = {




  /**
   * actually create a the WebGLSync and insert fence command in the GL command stream
   */
  insert : function(){
    if( this._sync === null && !this._invalidated ){
      this._sync = _factory( this.gl );
      this._pool();
    }
  },


  dispose : function(){
    this._release();
    this._defer = null;
    this.promise = null;
  },


  isSync : function(){
    if( this._sync === null ) {
      return false;
    }
    return this._sync.isSync();
  },

  /**
    * shortcut to this.promise.then
    */
  then : function( onFulfilled, onRejected ){
    this.promise.then( onFulfilled, onRejected );
  },

  /**
    * equivalent to gl.clientWaitSync. Sync must be "insert" before calling this, otherwise return GL_WAIT_FAILED.
    * @param {Number} [timeout  =1e6] in nanosec, default 100ms
    */
  clientWaitSync : function( timeout ){
    if( this._sync === null ){
      return 0x911D;// GL_WAIT_FAILED;
    }
    if( timeout === undefined ){
      timeout = 1e6;// 1sec
    }
    return this._sync.clientWaitSync( timeout );
  },


  _release : function(){
    this._defer.reject();
    this._unpool();
    this._invalidated = true;
    if( this._sync !== null ){
      this._sync.dispose();
      this._sync = null;
    }
  },


  _complete : function(){
    this._defer.resolve();
    this._release();
  },


  _pool : function(){
    if( !this._pooled ){
      __pool.push( this );
      this._pooled = true;
    }
  },


  _unpool : function(){
    if( this._pooled ){
      __pool.splice(  __pool.indexOf( this ), 1 );
      this._pooled = false;
    }
  }



};



function NativeImpl( gl ){
  this.gl = gl;
  this.sync = gl.fenceSync( 0x9117, 0 );// gl.SYNC_GPU_COMMANDS_COMPLETE
  gl.flush();
}


NativeImpl.prototype = {
  
  isSync : function(){
    //gl.SYNC_STATUS = gl.SIGNALED
    return this.gl.getSyncParameter( this.sync, 0x9114 ) === 0x9119; 
  },

  dispose : function(){
    this.gl.deleteSync( this.sync );
    this.gl = null;
    this.sync = null;
  },


  clientWaitSync : function( timeout ){
    return this.gl.clientWaitSync( this.sync, this.gl.SYNC_FLUSH_COMMANDS_BIT, timeout );
  },

};


function ShimImpl(){}

ShimImpl.prototype = {
  
  isSync : function(){
    return true;
  },

  dispose : function(){

  },

  clientWaitSync : function(){
    return 0x911A; //GL_ALREADY_SIGNALED
  },

};




module.exports = Sync;