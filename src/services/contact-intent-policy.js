/** 2026-09-17-v12: stricter buyer-contact intent policy. */
export function register(appContext){
  function insightContactMetrics(values){
    const contactOpens=Math.max(0,Number(values?.contact_opens||0));
    const contactVisitors=Math.max(0,Number(values?.contact_visitors||0));
    const inquiryCopies=Math.max(0,Number(values?.inquiry_copies||0));
    const platformClicks=Math.max(0,Number(values?.platform_clicks||0));

    // Opening Contact to Buy is useful engagement context, but it is not a
    // contact intent by itself. Count only an explicit copy/outbound action.
    // Math.max avoids double-counting one buyer moving through both steps.
    const intentCount=Math.max(inquiryCopies,platformClicks);

    let strongestStage="none";
    if(platformClicks>0) strongestStage="platform";
    else if(inquiryCopies>0) strongestStage="copy";
    else if(contactOpens>0 || contactVisitors>0) strongestStage="open";

    // Explicit inquiry copy = 2 points; outbound platform click = 3 points.
    // A single estimated intent can contribute no more than 3 points even if
    // the same buyer copies the inquiry and then clicks a contact platform.
    const rawContactScore=inquiryCopies*2 + platformClicks*3;
    const contactScore=Math.min(rawContactScore,intentCount*3);

    return {
      intent_count:intentCount,
      strongest_stage:strongestStage,
      contact_score:contactScore,
      contact_opens:contactOpens,
      contact_visitors:contactVisitors,
      inquiry_copies:inquiryCopies,
      platform_clicks:platformClicks
    };
  }

  function insightInterestScore(values){
    const contact=insightContactMetrics(values);
    return Math.round(
      Number(values?.overview_photo_interactions||0) +
      Number(values?.unique_views||0) +
      Number(values?.image_expands||0) +
      Number(values?.favorite_adds||0)*3 +
      Number(values?.shares||0)*4 +
      contact.contact_score
    );
  }

  Object.assign(appContext,{insightContactMetrics,insightInterestScore});
}
