# DM Client

## Overview

The package is used as client sdk to upload data to DM (DataMaster) platform.

## Examples

The following example shows how to construct, initialize, and add data to the batch.

```
import { DataBatch, FileField } from 'dm-client'

// construct the batch
let batch = new DataBatch('https://***.dm.com', 
		1, 
		'7be433c9-b332-4177-abeb-a636b017510a',
		'batch202306010800');

// initialize the batch.
// Remarks: client shall specify { allowUnauthorizedHttps: true } when connect to 
//          an https server without valid SSL certificate.
await batch.init();

// add objects to the batch
await batch.add('example', { key: 'speed', value: 100 });
await batch.add('example', { key: 'temperature', value: 30 });

// add objects with files attached
await batch.add('file', { file: new FileField('./overall.css'), name: 'overall.css'});

// complete the batch
await batch.complete();
```

## Classes

### DataBatch

### constructor()

*Syntax:* 

`constructor(String serverUrl, Integer collectorId, String collectorAppKey, String batchName)`

*Description:*

It create a DataBatch instance with the following arguments:

- serverUrl: The url of DM platform
- collectorId: The integer id of the collector. Please contact DM administrator to allocate a collector.
- collectorAppKey: The appKey of the collector.
- batchName: Name information that client names the batch

#### init()

*Syntax:*

`Promise(void) init(Map options)`

*Description:*

Initialize the batch from DM. The options could contains the following options or leave unspecified.

- allowUnauthorizedHttps: boolean, default to false. Client shall set it as true when connect to a https server without valid SSL certificates.

It will open a new batch for write if success. Otherwise, it will possibly throw the following Http Errors if error happens.

| Status | Error             | Description                                                  |
| ------ | ----------------- | ------------------------------------------------------------ |
| 401    | Invalid Collector | collectorId or collectorAppKey is invalid or doesn't match.  |
| 409    | Batch Conflict    | another batch is ongoing, client shall try again after it finished. |

#### add()

*Syntax:*

`Promise(void) add(String type, String json)`

*Description:*

It shall provide two arguments:

- type: type label of the data. (The same type of data within collector shall have the same schema)
- json: the data body in json format.

It will add a json object with the type to the batch if success. Otherwise, it will throw the following Http errors when error happens.

| Status | Error             | Description                                                 |
| ------ | ----------------- | ----------------------------------------------------------- |
| 401    | Invalid Collector | collectorId or collectorAppKey is invalid or doesn't match. |
| 403    | Invalid Batch     | the batch is invalid or cannot be written now.              |

#### complete()

*Syntax:*

`Promise(void) complete()`

*Description:*

Try to complete the current batch. It may wait for a short time depends on situation of the batch, and may throw the following Http errors in case of failure.

| Status | Error             | Description                                                 |
| ------ | ----------------- | ----------------------------------------------------------- |
| 401    | Invalid Collector | collectorId or collectorAppKey is invalid or doesn't match. |
| 403    | Invalid Batch     | the batch is invalid or cannot be written now.              |

#### cancel()

*Syntax:*

`Promise(void) cancel()`

*Description:*

Try to cancel the current batch. It may throw the following Http errors in case of failure.

| Status | Error             | Description                                                 |
| ------ | ----------------- | ----------------------------------------------------------- |
| 401    | Invalid Collector | collectorId or collectorAppKey is invalid or doesn't match. |
| 403    | Invalid Batch     | the batch is invalid or cannot be written now.              |

### FileField

### constructor()

*Syntax:* 

`constructor(String localPath)`

*Description:*

It create a FileField instance with the following arguments:

- localPath: The local path of the file



