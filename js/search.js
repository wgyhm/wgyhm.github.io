// A local search script with the help of
// [hexo-generator-search](https://github.com/PaicHyperionDev/hexo-generator-search)
// Copyright (C) 2015
// Joseph Pan <http://github.com/wzpan>
// Shuhao Mao <http://github.com/maoshuhao>
// This library is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation; either version 2.1 of the
// License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
// 02110-1301 USA
//
// Modified by:
// Pieter Robberechts <http://github.com/probberechts>

/*exported searchFunc*/
var searchFunc = function(path, searchId, contentId) {

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function stripHtml(html) {
    html = html.replace(/<style([\s\S]*?)<\/style>/gi, "");
    html = html.replace(/<script([\s\S]*?)<\/script>/gi, "");
    html = html.replace(/<figure([\s\S]*?)<\/figure>/gi, "");
    html = html.replace(/<\/div>/ig, "\n");
    html = html.replace(/<\/li>/ig, "\n");
    html = html.replace(/<li>/ig, "  *  ");
    html = html.replace(/<\/ul>/ig, "\n");
    html = html.replace(/<\/p>/ig, "\n");
    html = html.replace(/<br\s*[\/]?>/gi, "\n");
    html = html.replace(/<[^>]+>/ig, "");
    return html;
  }

  function getAllCombinations(keywords) {
    var i, j, result = [];

    for (i = 0; i < keywords.length; i++) {
        for (j = i + 1; j < keywords.length + 1; j++) {
            result.push(keywords.slice(i, j).join(" "));
        }
    }
    return result;
  }

  function highlightText(text, keywords) {
    var patterns = keywords.filter(Boolean).map(escapeRegExp);
    if (!patterns.length) {
      return escapeHtml(text);
    }
    var regS = new RegExp(patterns.join("|"), "gi");
    var result = "";
    var lastIndex = 0;

    text.replace(regS, function(keyword, index) {
      result += escapeHtml(text.slice(lastIndex, index));
      result += "<em class=\"search-keyword\">" + escapeHtml(keyword) + "</em>";
      lastIndex = index + keyword.length;
      return keyword;
    });

    result += escapeHtml(text.slice(lastIndex));
    return result;
  }

  function textFrom(node, selector) {
    var target = node.querySelector(selector);
    return target ? target.textContent : "";
  }

  function parseSearchXml(xmlText) {
    var xmlResponse = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xmlResponse.querySelector("parsererror")) {
      throw new Error("Failed to parse search XML");
    }

    return Array.prototype.map.call(xmlResponse.querySelectorAll("entry"), function(entry) {
      var link = entry.querySelector("link");
      return {
        title: textFrom(entry, "title"),
        content: textFrom(entry, "content"),
        url: link ? link.getAttribute("href") : ""
      };
    });
  }

  function setNoResultVisible(visible) {
    var noResult = document.querySelector(".search-no-result");
    if (noResult) {
      noResult.style.display = visible ? "block" : "none";
    }
  }

  function bindSearch(datas) {
    var $input = document.getElementById(searchId);
    if (!$input) { return; }
    var $resultContent = document.getElementById(contentId);
    if (!$resultContent) { return; }
    var searchData = datas.map(function(data) {
      var title = data.title && data.title.trim() ? data.title.trim() : "Untitled";
      var content = stripHtml((data.content || "").trim());
      return {
        title: title,
        titleLowerCase: title.toLowerCase(),
        content: content,
        contentLowerCase: content.toLowerCase(),
        url: data.url || ""
      };
    });

    function renderSearchResults() {
      var resultList = [];
      var rawValue = $input.value.trim();
      $resultContent.innerHTML = "";
      setNoResultVisible(false);

      if (rawValue.length <= 0) {
        return;
      }

      var keywords = getAllCombinations(rawValue.toLowerCase().split(/\s+/))
        .sort(function(a,b) { return b.split(/\s+/).length - a.split(/\s+/).length; });

      // perform local searching
      searchData.forEach(function(data) {
        var matches = 0;
        var dataTitle = data.title;
        var dataTitleLowerCase = data.titleLowerCase;
        var dataContent = data.content;
        var dataContentLowerCase = data.contentLowerCase;
        var dataUrl = data.url;
        var indexTitle = -1;
        var indexContent = -1;
        var firstOccur = -1;

        keywords.forEach(function(keyword) {
          indexTitle = dataTitleLowerCase.indexOf(keyword);
          indexContent = dataContentLowerCase.indexOf(keyword);

          if( indexTitle >= 0 || indexContent >= 0 ){
            matches += 1;
            if (indexContent < 0) {
              indexContent = 0;
            }
            if (firstOccur < 0) {
              firstOccur = indexContent;
            }
          }
        });

        // show search results
        if (matches > 0) {
          var searchResult = {};
          searchResult.rank = matches;
          searchResult.str = "<li><a href='" + escapeHtml(dataUrl) + "' class='search-result-title'>" + escapeHtml(dataTitle) + "</a>";
          if (firstOccur >= 0) {
            // cut out 100 characters
            var start = firstOccur - 20;
            var end = firstOccur + 80;

            if(start < 0){
              start = 0;
            }

            if(start == 0){
              end = 100;
            }

            if(end > dataContent.length){
              end = dataContent.length;
            }

            var matchContent = dataContent.substring(start, end);
            searchResult.str += "<p class=\"search-result\">" + highlightText(matchContent, keywords) +"...</p>";
          }
          searchResult.str += "</li>";
          resultList.push(searchResult);
        }
      });

      if (resultList.length) {
        resultList.sort(function(a, b) {
            return b.rank - a.rank;
        });
        var result ="<ul class=\"search-result-list\">";
        for (var i = 0; i < resultList.length; i++) {
          result += resultList[i].str;
        }
        result += "</ul>";
        $resultContent.innerHTML = result;
      } else {
        setNoResultVisible(true);
      }
    }

    $input.addEventListener("input", renderSearchResults);
    renderSearchResults();
  }

  fetch(path)
    .then(function(response) {
      if (!response.ok) {
        throw new Error("Failed to load search index: " + response.status);
      }
      return response.text();
    })
    .then(function(xmlText) {
      bindSearch(parseSearchXml(xmlText));
    })
    .catch(function(error) {
      // Keep the page usable while making the failure visible in devtools.
      console.error(error);
      setNoResultVisible(true);
    });
};

window.searchFunc = searchFunc;
