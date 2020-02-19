'use strict';

const FS = require('fs');
const AWS = require('aws-sdk');
const SSM = new AWS.SSM();
const PersonalizeRT = new AWS.PersonalizeRuntime();

let   PersonalizeCampaignArns;
const MaxNumResults = process.env.MaxNumResults;
const ProductData = loadProductDataFromFile(process.env.FileProductData);
const ColorsArray = ['#78281f','#512e5f','#1b4f72','#0b5345','#186a3b','#7e5109','#6e2c00','#6e2c00','#424949','#17202a',];

const getHashCode = s => s.split('').reduce((a,b) => (((a << 5) - a) + b.charCodeAt(0))|0, 0);

async function getPersonalizeCampaignArns(paramNamesArray, isEncrypted) {
  isEncrypted = isEncrypted === true ? true : false;
  let arnsObject = {};
  try {
    const data = await SSM.getParameters({ Names: paramNamesArray, WithDecryption: isEncrypted }).promise();
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

function loadProductDataFromFile(file) {
  const dataRaw = JSON.parse(FS.readFileSync(file, 'utf8'));
  let dataDict = {};
  for(let i = 0; i < dataRaw.length; i++) {
    dataDict[dataRaw[i].item_id] = dataRaw[i];
  }
  return dataDict;
}

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
  let params = {};
  if(!PersonalizeCampaignArns)
    PersonalizeCampaignArns = await getPersonalizeCampaignArns([process.env.SsmPersonalizeArnCampaignByUser, process.env.SsmPersonalizeArnCampaignByItem], process.env.SsmIsEncrypted);
  if(PersonalizeCampaignArns && PersonalizeCampaignArns.ByUser && PersonalizeCampaignArns.ByItem) {
    params.campaignArn = itemId && !userId ? PersonalizeCampaignArns.ByItem : PersonalizeCampaignArns.ByUser;
    params.numResults = MaxNumResults;
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

function getApiData(inputParams, dataPersonalize) {
  let dataHydrated = [];
  if(dataPersonalize && dataPersonalize.itemList && dataPersonalize.itemList.length > 0) {
    for(let i = 0; i < dataPersonalize.itemList.length; i++) {
      let product = ProductData[dataPersonalize.itemList[i].itemId];
      if(product) {
        const colorIndex = Math.abs(getHashCode(product.item_id)) % ColorsArray.length;  //product.product_reviews % ColorsArray.length;
        product.bg_color = ColorsArray[colorIndex];
        product.product_rating_rounded = Math.round((product.product_rating + Number.EPSILON) * 100) / 100;
      }
      dataHydrated.push(product);
    }
  }
  const apiData = {
    InputParams: inputParams,
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

module.exports.GetRecommendationsByUser = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.userId)
    return getHttpResponse(400, null, "No ID Input Received");

  const params = await getPersonalizeParams(event.pathParameters.userId, null);                         //via ONLY userId
  const personalizeData = await getRecommendationsData(params);
  const apiData = getApiData(params, personalizeData);

  return getApiResponse(apiData);
};

module.exports.GetRecommendationsByItem = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.itemId)
    return getHttpResponse(400, null, "No ID Input Received");

  const params = await getPersonalizeParams(null, event.pathParameters.itemId);                         //via ONLY itemId
  const personalizeData = await getRecommendationsData(params);
  const apiData = getApiData(params, personalizeData);

  return getApiResponse(apiData);
};

module.exports.GetRecommendationsByUserItem = async (event) => {
  if(!event || !event.pathParameters || !event.pathParameters.userId || !event.pathParameters.itemId)
    return getHttpResponse(400, null, "No ID Input Received");

  const params = await getPersonalizeParams(event.pathParameters.userId, event.pathParameters.itemId);  //via userId AND itemId
  const personalizeData = await getRecommendationsData(params);
  const apiData = getApiData(params, personalizeData);

  return getApiResponse(apiData);
};
