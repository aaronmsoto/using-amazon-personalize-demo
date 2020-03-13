'use strict';

const FS = require('fs');
const AWS = require('aws-sdk');
const SSM = new AWS.SSM();
const PersonalizeRT = new AWS.PersonalizeRuntime();
// const RDS = new AWS.RDSDataService();
// const DATA = require('data-api-client')({});

let   DATA;
let   AuroraConnParams;
let   PersonalizeCampaignArns;
const MaxNumResults = parseInt(process.env.MaxNumResults);
const FileFieldProductID = process.env.FileFieldProductID;
const FileFieldProductName = process.env.FileFieldProductName;
const FileFieldProductThumbnail = process.env.FileFieldProductThumbnail;
let ProductData;
// const ProductData = loadProductDataFromFile(process.env.FileProductData);

const UserInfoCache = [];
const ItemRecommendationsCache = [];
const UserRecommendationsCache = [];
const UserItemRecommendationsCache = [];

async function getAuroraConnParams(paramNamesArray, isEncrypted) {
  isEncrypted = isEncrypted === true || isEncrypted === "true" ? true : false;
  let connParams = {};
  try {
    const params = { Names: paramNamesArray, WithDecryption: isEncrypted };
    const data = await SSM.getParameters(params).promise();
    if(data && data.Parameters && data.Parameters.length > 0) {
      for(let i = 0; i < data.Parameters.length; i++) {
        if(data.Parameters[i].Name === process.env.SsmAuroraClusterArn)
          connParams.resourceArn = data.Parameters[i].Value;
        if(data.Parameters[i].Name === process.env.SsmAuroraSecretsArn)
          connParams.secretArn = data.Parameters[i].Value;
        if(data.Parameters[i].Name === process.env.SsmAuroraDatabaseName)
          connParams.database = data.Parameters[i].Value;
      }
    }
  }
  catch (err) {
    console.log(err, err.stack);                    // an error occurred
  }
  return connParams;
}

async function getPersonalizeCampaignArns(paramNamesArray, isEncrypted) {
  isEncrypted = isEncrypted === true || isEncrypted === "true" ? true : false;
  let arnsObject = {};
  try {
    const params = { Names: paramNamesArray, WithDecryption: isEncrypted };
    const data = await SSM.getParameters(params).promise();
    if(data && data.Parameters && data.Parameters.length > 0) {
      for(let i = 0; i < data.Parameters.length; i++) {
        if(data.Parameters[i].Name === process.env.SsmPersonalizeArnCampaignByUser)
          arnsObject.ByUser = data.Parameters[i].Value;
        if(data.Parameters[i].Name === process.env.SsmPersonalizeArnCampaignByItem)
          arnsObject.ByItem = data.Parameters[i].Value;
      }
    }
  }
  catch (err) {
    console.log(err, err.stack);                    // an error occurred
  }
  return arnsObject;
}

async function executeAuroraSqlStatement(sql) {
  let data;
  if(!AuroraConnParams) {
    AuroraConnParams = await getAuroraConnParams([process.env.SsmAuroraClusterArn, process.env.SsmAuroraSecretsArn, process.env.SsmAuroraDatabaseName], process.env.SsmIsEncrypted)
  }
  if(AuroraConnParams) {
    try {
      if(!DATA) {
        DATA = require('data-api-client')(AuroraConnParams);
      }
      const response = await DATA.query(sql);
      if(response && response.records) {
        data = response.records;
      }
    }
    catch (err) {
      console.log(err, err.stack);                    // an error occurred
    }
  }
  return data;
}

function loadProductDataFromFile(file) {
  const dataRaw = JSON.parse(FS.readFileSync(file, 'utf8'));
  let dataDict = {};
  for(let i = 0; i < dataRaw.length; i++) {
    dataDict[dataRaw[i][FileFieldProductID]] = dataRaw[i];
  }
  return dataDict;
}

//Max records returnable is 1000, which is less than my number of movies so sticking with the JSON file approach above for now...
// async function loadProductData() {
//   const dataRaw = await executeAuroraSqlStatement("SELECT * FROM movies LIMIT 1;")
//   let dataDict = {};
//   if(dataRaw) {
//     for(let i = 0; i < dataRaw.length; i++) {
//       dataDict[dataRaw[i][FileFieldProductID]] = dataRaw[i];
//     }
//   }
//   return dataDict;
// }

function getHttpResponse(statusCode, body, message) {
  const responseBody = body ? body : message;
  const httpResponse = {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(responseBody, null, 2)
  };
  return httpResponse;
}

async function getPersonalizeParams(userId, itemId) {
  const numResults = userId && itemId ? MaxNumResults + 1 : MaxNumResults;
  let params = {};
  if(!PersonalizeCampaignArns)
    PersonalizeCampaignArns = await getPersonalizeCampaignArns([process.env.SsmPersonalizeArnCampaignByUser, process.env.SsmPersonalizeArnCampaignByItem], process.env.SsmIsEncrypted);
  if(PersonalizeCampaignArns && PersonalizeCampaignArns.ByUser && PersonalizeCampaignArns.ByItem) {
    params.campaignArn = itemId && !userId ? PersonalizeCampaignArns.ByItem : PersonalizeCampaignArns.ByUser;
    params.numResults = numResults;
    params.userId = userId;
    params.itemId = itemId;
  }
  return params;
}

async function getRecommendationsData(params) {
  let data;
  try {
    data = await PersonalizeRT.getRecommendations(params).promise();
  }
  catch (err) {
    console.log(err, err.stack);              // an error occurred
    return null;
  }
  return data;
}

async function getUserMovieInteractions(userId) {
  const sql = `SELECT user_id, username, age, gender, occupation, rating_stars, rating_timestamp, movie_id, movie_title, IMDB_url AS ${FileFieldProductThumbnail} 
               FROM movielikes_view 
               WHERE user_id = ${userId} 
               ORDER BY rating_timestamp DESC 
               LIMIT ${process.env.MaxNumResults};`
  const interactions = await executeAuroraSqlStatement(sql);
  if(interactions && interactions.length > 0) {
    for(let i = 0; i < interactions.length; i++) {
      interactions[i].ProductID = interactions[i][FileFieldProductID];
      interactions[i].ProductName = interactions[i][FileFieldProductName];
      interactions[i].ProductThumbnail = interactions[i][FileFieldProductThumbnail];
    }
  }
  return interactions;
}

function obfuscateCampaignArn(fullArn) {
  let maskedArn = "";
  const splitString = ":campaign/";
  if(fullArn && fullArn.indexOf(splitString)) {
    const arnArray = fullArn.split(splitString);
    maskedArn = "..." + splitString + arnArray[1];
  }
  return maskedArn;
}

async function getApiData(inputParams, dataPersonalize) {
  let userInfo = {};
  let interactionsArray = [];
  let dataHydrated = [];
  if(!ProductData) {
    ProductData = await loadProductDataFromFile(process.env.FileProductData);
  }
  if(dataPersonalize && dataPersonalize.itemList && dataPersonalize.itemList.length > 0) {
    for(let i = 0; i < dataPersonalize.itemList.length; i++) {
      let product = ProductData[dataPersonalize.itemList[i].itemId];
      if(product && dataHydrated.length < MaxNumResults && (!inputParams.itemId || inputParams.itemId != product[FileFieldProductID])) {
        //Map possibly dynamic field names to our set of known fields... (the above IF excludes recommendations for the SAME ITEM!)
        product.ProductID = product[FileFieldProductID];
        product.ProductName = product[FileFieldProductName];
        product.ProductThumbnail = product[FileFieldProductThumbnail];
        dataHydrated.push(product);
      }
    }
  }
  if(inputParams.userId) {
    interactionsArray = await getUserMovieInteractions(inputParams.userId);
    if(interactionsArray.length > 0) {
      userInfo = {
        id: interactionsArray[0].user_id,
        username: interactionsArray[0].username,
        age: interactionsArray[0].age,
        gender: interactionsArray[0].gender,
        occupation: interactionsArray[0].occupation
      }
    }
  }
  inputParams.campaignArn = obfuscateCampaignArn(inputParams.campaignArn);
  const apiData = {
    InputParams: inputParams,
    UserInfo: userInfo,
    InteractionsHistory: interactionsArray,
    HydratedProductData: dataHydrated,
    RawPersonalizeData: dataPersonalize
  };
  console.log(JSON.stringify(apiData, null, 2));
  return apiData;
}

function getApiResponse(data) {
  if(data)
    return getHttpResponse(200, data, null);
  else
    return getHttpResponse(500, null, "Data Retrieval Error");
}

module.exports.GetRecommendationsByItem = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.itemId)
    return getHttpResponse(400, null, "No ID Input Received");
  
  let itemId = event.pathParameters.itemId;
  if(!ItemRecommendationsCache[itemId]) {
    const params = await getPersonalizeParams(null, itemId);                         //via ONLY itemId
    const personalizeData = await getRecommendationsData(params);
    ItemRecommendationsCache[itemId] = await getApiData(params, personalizeData);  
  }
  
  return getApiResponse(ItemRecommendationsCache[itemId]);
};

module.exports.GetRecommendationsByUser = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.userId)
    return getHttpResponse(400, null, "No ID Input Received");
  
  let userId = event.pathParameters.userId;
  if(!UserRecommendationsCache[userId]) {
    const params = await getPersonalizeParams(userId, null);                         //via ONLY userId
    const personalizeData = await getRecommendationsData(params);
    UserRecommendationsCache[userId] = await getApiData(params, personalizeData);  
  }
  
  return getApiResponse(UserRecommendationsCache[userId]);
};

module.exports.GetRecommendationsByUserItem = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.userId || !event.pathParameters.itemId)
    return getHttpResponse(400, null, "No ID Input Received");

  let userId = event.pathParameters.userId;
  let itemId = event.pathParameters.itemId;
  if(!UserItemRecommendationsCache[`${userId}+${itemId}`]) {
    const params = await getPersonalizeParams(userId, itemId);                       //via userId AND itemId
    const personalizeData = await getRecommendationsData(params);
    UserItemRecommendationsCache[`${userId}+${itemId}`] = await getApiData(params, personalizeData);
  }

  return getApiResponse(UserItemRecommendationsCache[`${userId}+${itemId}`]);
};
